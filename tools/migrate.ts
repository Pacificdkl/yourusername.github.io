/**
 * Migration runner. Applies migrations/NNNN_*.sql in order against DATABASE_URL,
 * tracking applied files in a `schema_migrations` table so it is idempotent.
 *
 * Only files matching /^\d{4}_.*\.sql$/ are applied; SCHEMA.reference.sql and
 * the commented `-- DOWN` sections are ignored (DOWN lines are comments, so the
 * whole file is safe to execute as the UP migration).
 *
 * Run: `pnpm db:migrate` (needs DATABASE_URL).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. See .env.example.');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString });
  try {
    await pool.query(
      `create table if not exists schema_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    );
    const applied = new Set(
      (await pool.query<{ name: string }>('select name from schema_migrations')).rows.map(
        (r) => r.name,
      ),
    );

    for (const name of migrationFiles()) {
      if (applied.has(name)) {
        console.log(`= skip ${name} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [name]);
        await client.query('commit');
        console.log(`+ applied ${name}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`migration ${name} failed: ${(err as Error).message}`);
      } finally {
        client.release();
      }
    }
    console.log('migrations up to date.');
  } finally {
    await pool.end();
  }
}

void main();
