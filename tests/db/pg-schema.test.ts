/**
 * Database schema + RLS proof against REAL Postgres (via pglite, in-process).
 *
 * This verifies the database-level controls that the in-memory store can only
 * approximate:
 *   - every migration applies cleanly;
 *   - the BDSM `safety_notes` CHECK rejects a bad insert (§6);
 *   - the `shippable_content` guard hides unreviewed rows (§6);
 *   - **RLS on `boundary_answers` blocks cross-user reads (invariant #5)** —
 *     the primary boundary-opacity control in production.
 *
 * RLS is tested as a NON-owner, non-superuser role (`app_user`), because
 * superusers bypass RLS. `app.current_user` is set the same way the request
 * handler would set it per request.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

let db: PGlite;

async function setUser(id: string): Promise<void> {
  await db.query('select set_config($1, $2, false)', ['app.current_user', id]);
}

beforeAll(async () => {
  db = new PGlite();
  const files = readdirSync(MIG_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  for (const f of files) {
    await db.exec(readFileSync(join(MIG_DIR, f), 'utf8'));
  }
  // A non-owner role so RLS actually applies (owner/superuser would bypass it).
  await db.exec(`
    create role app_user nologin;
    grant select, insert, update, delete on all tables in schema public to app_user;
  `);
});

describe('migrations', () => {
  it('all applied and created the core tables', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = rows.map((r) => r.table_name);
    for (const t of ['users', 'content_items', 'pairings', 'invite_codes', 'boundary_answers', 'sessions', 'session_draws', 'favourites']) {
      expect(names).toContain(t);
    }
  });
});

describe('content constraints (§6)', () => {
  it('rejects a BDSM item with empty safety_notes', async () => {
    await expect(
      db.query(
        `insert into content_items (title, category, description, intensity, difficulty, source, licence, safety_notes)
         values ('x', 'bdsm', 'd', 2, 2, 's', 'l', '')`,
      ),
    ).rejects.toThrow();
  });

  it('shippable_content excludes unreviewed rows', async () => {
    await db.query(
      `insert into content_items (title, category, description, intensity, difficulty, source, licence, reviewed_by, reviewed_at)
       values ('reviewed', 'position', 'd', 1, 1, 's', 'l', 'r', now())`,
    );
    await db.query(
      `insert into content_items (title, category, description, intensity, difficulty, source, licence)
       values ('unreviewed', 'position', 'd', 1, 1, 's', 'l')`,
    );
    const all = await db.query(`select count(*)::int as n from content_items`);
    const shippable = await db.query(`select count(*)::int as n from shippable_content`);
    expect((all.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(2);
    expect((shippable.rows[0] as { n: number }).n).toBe(1);
  });
});

describe('RLS blocks cross-user boundary reads (invariant #5)', () => {
  let a: string;
  let b: string;

  beforeAll(async () => {
    // Seed as owner (RLS bypassed) so both users' rows exist.
    const ra = await db.query<{ id: string }>(`insert into users default values returning id`);
    const rb = await db.query<{ id: string }>(`insert into users default values returning id`);
    a = ra.rows[0]!.id;
    b = rb.rows[0]!.id;
    await db.query(`insert into boundary_answers (user_id, item_id, answer) values ($1, gen_random_uuid(), 'enc:a')`, [a]);
    await db.query(`insert into boundary_answers (user_id, item_id, answer) values ($1, gen_random_uuid(), 'enc:b')`, [b]);
  });

  it('a query with no WHERE returns only the current user\'s rows', async () => {
    await db.exec('set role app_user');
    try {
      await setUser(a);
      const asA = await db.query<{ user_id: string }>('select user_id from boundary_answers');
      expect(asA.rows).toHaveLength(1);
      expect(asA.rows[0]!.user_id).toBe(a);

      await setUser(b);
      const asB = await db.query<{ user_id: string }>('select user_id from boundary_answers');
      expect(asB.rows).toHaveLength(1);
      expect(asB.rows[0]!.user_id).toBe(b);
    } finally {
      await db.exec('reset role');
    }
  });

  it('a user cannot insert a row for someone else (WITH CHECK)', async () => {
    await db.exec('set role app_user');
    try {
      await setUser(a);
      await expect(
        db.query(`insert into boundary_answers (user_id, item_id, answer) values ($1, gen_random_uuid(), 'x')`, [b]),
      ).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
  });
});
