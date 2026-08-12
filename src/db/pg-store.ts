/**
 * PostgreSQL implementation of the store (ADR 0015). Depends only on a minimal
 * `Db` interface, satisfied by pglite in tests and by a thin `pg.Pool` wrapper
 * in production (see `pgPoolToDb` note at the bottom).
 *
 * RLS-scoped operations (boundary_answers, favourites) run inside a transaction
 * that sets `app.current_user`, so the database's row-level security is the
 * enforcement even if the SQL predicate were wrong — see
 * migrations/0004_boundaries.sql and tests/db/pg-schema.test.ts.
 *
 * Field encryption at rest (§5, ADR 0005) is applied here exactly as in the
 * in-memory store: `boundary_answers.answer` and `session_draws.item_id` are
 * encrypted before insert and decrypted on read.
 */

import { encryptField, decryptField } from '@/crypto/field';
import type {
  BoundaryAnswer,
  BoundaryAnswerRow,
  ContentItemRecord,
  ContentStore,
  InviteCode,
  MagicToken,
  Pairing,
  PairingStore,
  PendingChallenge,
  SessionDrawRow,
  SessionRow,
  StoredCredential,
  UnpairResult,
  User,
  UserStore,
  VerificationRecord,
  BoundaryStore,
} from './types';

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

type Row = Record<string, unknown>;

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v as string);
}
function reqDate(v: unknown): Date {
  const d = toDate(v);
  if (!d) throw new Error('expected a date');
  return d;
}
function toBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return Uint8Array.from(v as number[]);
  // pg returns Buffer (a Uint8Array subclass); pglite returns Uint8Array.
  return new Uint8Array(v as ArrayBufferLike);
}

function mapUser(r: Row): User {
  return {
    id: r.id as string,
    createdAt: reqDate(r.created_at),
    ageVerified: Boolean(r.age_verified),
    providerRef: (r.provider_ref as string) ?? null,
    verifiedAt: toDate(r.verified_at),
    deviceFpHash: (r.device_fp_hash as string) ?? null,
    pinHash: (r.pin_hash as string) ?? null,
    consentVersion: (r.consent_version as string) ?? null,
    consentGrantedAt: toDate(r.consent_granted_at),
  };
}
function mapPairing(r: Row): Pairing {
  return {
    id: r.id as string,
    userA: r.user_a as string,
    userB: r.user_b as string,
    status: r.status as Pairing['status'],
    createdAt: reqDate(r.created_at),
    confirmedA: Boolean(r.confirmed_a),
    confirmedB: Boolean(r.confirmed_b),
  };
}
function mapSession(r: Row): SessionRow {
  return {
    id: r.id as string,
    pairingId: r.pairing_id as string,
    intensityCap: Number(r.intensity_cap),
    noRepeat: Boolean(r.no_repeat),
    categories: (r.categories as SessionRow['categories']) ?? null,
    startedAt: reqDate(r.started_at),
    endedAt: toDate(r.ended_at),
  };
}
function mapContent(r: Row): ContentItemRecord {
  return {
    id: r.id as string,
    title: r.title as string,
    category: r.category as ContentItemRecord['category'],
    description: r.description as string,
    intensity: Number(r.intensity),
    difficulty: Number(r.difficulty),
    tags: (r.tags as string[]) ?? [],
    safetyNotes: (r.safety_notes as string) ?? '',
    source: r.source as string,
    licence: r.licence as string,
    reviewedBy: (r.reviewed_by as string) ?? null,
    reviewedAt: toDate(r.reviewed_at),
  };
}

export class PgStore implements UserStore, PairingStore, BoundaryStore, ContentStore {
  constructor(private readonly db: Db) {}

  private scoped<T>(userId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.query("select set_config('app.current_user', $1, true)", [userId]);
      return fn(tx);
    });
  }

  // --- UserStore ---

  async createUser(): Promise<User> {
    const { rows } = await this.db.query<Row>('insert into users default values returning *');
    return mapUser(rows[0]!);
  }

  async findUser(id: string): Promise<User | null> {
    const { rows } = await this.db.query<Row>('select * from users where id = $1', [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async markVerified(userId: string, record: VerificationRecord): Promise<void> {
    await this.db.query(
      'update users set age_verified = true, provider_ref = $2, verified_at = $3 where id = $1',
      [userId, record.providerRef, record.verifiedAt],
    );
  }

  async setPinHash(userId: string, pinHash: string): Promise<void> {
    await this.db.query('update users set pin_hash = $2 where id = $1', [userId, pinHash]);
  }

  async setConsent(userId: string, version: string, grantedAt: Date): Promise<void> {
    await this.db.query(
      'update users set consent_version = $2, consent_granted_at = $3 where id = $1',
      [userId, version, grantedAt],
    );
  }

  async withdrawConsent(userId: string): Promise<void> {
    await this.db.query(
      'update users set consent_version = null, consent_granted_at = null where id = $1',
      [userId],
    );
  }

  async deleteUser(userId: string): Promise<void> {
    // Unpair first (removes the shared pairing + its sessions/draws via cascade),
    // then delete the user (cascades credentials/tokens/answers/email). One tx.
    await this.db.transaction(async (tx) => {
      await tx.query(
        `delete from pairings where status <> 'ended' and (user_a = $1 or user_b = $1)`,
        [userId],
      );
      await tx.query('delete from users where id = $1', [userId]);
    });
  }

  async addCredential(userId: string, cred: StoredCredential): Promise<void> {
    await this.db.query(
      `insert into webauthn_credentials (id, user_id, public_key, counter, transports)
       values ($1, $2, $3, $4, $5)`,
      [cred.id, userId, cred.publicKey, cred.counter, cred.transports ?? null],
    );
  }

  async getCredentials(userId: string): Promise<StoredCredential[]> {
    const { rows } = await this.db.query<Row>(
      'select * from webauthn_credentials where user_id = $1',
      [userId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      publicKey: toBytes(r.public_key),
      counter: Number(r.counter),
      ...(r.transports ? { transports: r.transports as string[] } : {}),
    }));
  }

  async findCredentialById(
    credentialId: string,
  ): Promise<{ userId: string; cred: StoredCredential } | null> {
    const { rows } = await this.db.query<Row>(
      'select * from webauthn_credentials where id = $1',
      [credentialId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      userId: r.user_id as string,
      cred: {
        id: r.id as string,
        publicKey: toBytes(r.public_key),
        counter: Number(r.counter),
        ...(r.transports ? { transports: r.transports as string[] } : {}),
      },
    };
  }

  async updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
    await this.db.query('update webauthn_credentials set counter = $2 where id = $1', [
      credentialId,
      counter,
    ]);
  }

  async putChallenge(c: PendingChallenge): Promise<void> {
    await this.db.query(
      `insert into webauthn_challenges (user_id, challenge, expires_at)
       values ($1, $2, $3)
       on conflict (user_id) do update set challenge = excluded.challenge, expires_at = excluded.expires_at`,
      [c.userId, c.challenge, c.expiresAt],
    );
  }

  async takeChallenge(userId: string): Promise<PendingChallenge | null> {
    const { rows } = await this.db.query<Row>(
      'delete from webauthn_challenges where user_id = $1 returning *',
      [userId],
    );
    const r = rows[0];
    if (!r) return null;
    const expiresAt = reqDate(r.expires_at);
    if (expiresAt.getTime() < Date.now()) return null;
    return { userId, challenge: r.challenge as string, expiresAt };
  }

  async putMagicToken(t: MagicToken): Promise<void> {
    await this.db.query(
      `insert into magic_tokens (token_hash, user_id, expires_at, consumed_at)
       values ($1, $2, $3, $4)`,
      [t.tokenHash, t.userId, t.expiresAt, t.consumedAt],
    );
  }

  async consumeMagicToken(tokenHash: string, now: Date): Promise<MagicToken | null> {
    const { rows } = await this.db.query<Row>(
      `update magic_tokens set consumed_at = $2
       where token_hash = $1 and consumed_at is null and expires_at >= $2
       returning *`,
      [tokenHash, now],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      tokenHash: r.token_hash as string,
      userId: r.user_id as string,
      expiresAt: reqDate(r.expires_at),
      consumedAt: toDate(r.consumed_at),
    };
  }

  async findUserIdByEmailHash(emailHash: string): Promise<string | null> {
    const { rows } = await this.db.query<Row>(
      'select user_id from email_identities where email_hash = $1',
      [emailHash],
    );
    return rows[0] ? (rows[0].user_id as string) : null;
  }

  async linkEmailHash(emailHash: string, userId: string): Promise<void> {
    await this.db.query(
      `insert into email_identities (email_hash, user_id) values ($1, $2)
       on conflict (email_hash) do update set user_id = excluded.user_id`,
      [emailHash, userId],
    );
  }

  // --- PairingStore ---

  async createInvite(invite: InviteCode): Promise<void> {
    await this.db.query(
      `insert into invite_codes (code, issuer, expires_at, consumed_at) values ($1, $2, $3, $4)`,
      [invite.code, invite.issuer, invite.expiresAt, invite.consumedAt],
    );
  }

  async getInvite(code: string): Promise<InviteCode | null> {
    const { rows } = await this.db.query<Row>('select * from invite_codes where code = $1', [code]);
    const r = rows[0];
    if (!r) return null;
    return {
      code: r.code as string,
      issuer: r.issuer as string,
      expiresAt: reqDate(r.expires_at),
      consumedAt: toDate(r.consumed_at),
    };
  }

  async consumeInvite(code: string, now: Date): Promise<InviteCode | null> {
    const { rows } = await this.db.query<Row>(
      `update invite_codes set consumed_at = $2
       where code = $1 and consumed_at is null and expires_at >= $2
       returning *`,
      [code, now],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      code: r.code as string,
      issuer: r.issuer as string,
      expiresAt: reqDate(r.expires_at),
      consumedAt: toDate(r.consumed_at),
    };
  }

  async createPairing(p: Pairing): Promise<void> {
    await this.db.query(
      `insert into pairings (id, user_a, user_b, status, created_at, confirmed_a, confirmed_b)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [p.id, p.userA, p.userB, p.status, p.createdAt, p.confirmedA, p.confirmedB],
    );
  }

  async getPairing(id: string): Promise<Pairing | null> {
    const { rows } = await this.db.query<Row>('select * from pairings where id = $1', [id]);
    return rows[0] ? mapPairing(rows[0]) : null;
  }

  async getPairingForUser(userId: string): Promise<Pairing | null> {
    const { rows } = await this.db.query<Row>(
      `select * from pairings where status <> 'ended' and (user_a = $1 or user_b = $1) limit 1`,
      [userId],
    );
    return rows[0] ? mapPairing(rows[0]) : null;
  }

  async updatePairing(p: Pairing): Promise<void> {
    await this.db.query(
      `update pairings set status = $2, confirmed_a = $3, confirmed_b = $4 where id = $1`,
      [p.id, p.status, p.confirmedA, p.confirmedB],
    );
  }

  async addSession(session: SessionRow): Promise<void> {
    await this.db.query(
      `insert into sessions (id, pairing_id, intensity_cap, no_repeat, categories, started_at, ended_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.id,
        session.pairingId,
        session.intensityCap,
        session.noRepeat,
        session.categories,
        session.startedAt,
        session.endedAt,
      ],
    );
  }

  async getSession(id: string): Promise<SessionRow | null> {
    const { rows } = await this.db.query<Row>('select * from sessions where id = $1', [id]);
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async updateSession(session: SessionRow): Promise<void> {
    await this.db.query(
      `update sessions set intensity_cap = $2, no_repeat = $3, categories = $4, ended_at = $5 where id = $1`,
      [session.id, session.intensityCap, session.noRepeat, session.categories, session.endedAt],
    );
  }

  async getActiveSessionForPairing(pairingId: string): Promise<SessionRow | null> {
    const { rows } = await this.db.query<Row>(
      'select * from sessions where pairing_id = $1 and ended_at is null limit 1',
      [pairingId],
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async addSessionDraw(draw: SessionDrawRow): Promise<void> {
    await this.db.query(
      'insert into session_draws (session_id, item_id, drawn_at) values ($1, $2, $3)',
      [draw.sessionId, await encryptField(draw.itemId), draw.drawnAt],
    );
  }

  async getSessionsForPairing(pairingId: string): Promise<SessionRow[]> {
    const { rows } = await this.db.query<Row>(
      'select * from sessions where pairing_id = $1',
      [pairingId],
    );
    return rows.map(mapSession);
  }

  async getDrawsForSession(sessionId: string): Promise<SessionDrawRow[]> {
    const { rows } = await this.db.query<Row>(
      'select * from session_draws where session_id = $1',
      [sessionId],
    );
    return Promise.all(
      rows.map(async (r) => ({
        sessionId: r.session_id as string,
        itemId: await decryptField(r.item_id as string),
        drawnAt: reqDate(r.drawn_at),
      })),
    );
  }

  async unpairUser(userId: string): Promise<UnpairResult> {
    return this.db.transaction(async (tx) => {
      const found = await tx.query<Row>(
        `select id from pairings where status <> 'ended' and (user_a = $1 or user_b = $1) limit 1`,
        [userId],
      );
      const pairing = found.rows[0];
      if (!pairing) return { pairingId: null, deletedSessionIds: [] };
      const pairingId = pairing.id as string;

      const sessions = await tx.query<Row>('select id from sessions where pairing_id = $1', [
        pairingId,
      ]);
      const deletedSessionIds = sessions.rows.map((r) => r.id as string);

      // FK ON DELETE CASCADE removes sessions + their draws with the pairing.
      await tx.query('delete from pairings where id = $1', [pairingId]);
      return { pairingId, deletedSessionIds };
    });
  }

  // --- BoundaryStore (RLS-scoped) ---

  async setBoundaryAnswer(userId: string, itemId: string, answer: BoundaryAnswer): Promise<void> {
    const enc = await encryptField(answer); // ciphertext at rest (§5)
    await this.scoped(userId, (tx) =>
      tx.query(
        `insert into boundary_answers (user_id, item_id, answer) values ($1, $2, $3)
         on conflict (user_id, item_id) do update set answer = excluded.answer`,
        [userId, itemId, enc],
      ),
    );
  }

  async getBoundaryAnswer(userId: string, itemId: string): Promise<BoundaryAnswer | null> {
    return this.scoped(userId, async (tx) => {
      const { rows } = await tx.query<Row>(
        'select answer from boundary_answers where user_id = $1 and item_id = $2',
        [userId, itemId],
      );
      return rows[0] ? ((await decryptField(rows[0].answer as string)) as BoundaryAnswer) : null;
    });
  }

  async getBoundaryAnswers(userId: string): Promise<BoundaryAnswerRow[]> {
    return this.scoped(userId, async (tx) => {
      const { rows } = await tx.query<Row>(
        'select item_id, answer from boundary_answers where user_id = $1',
        [userId],
      );
      return Promise.all(
        rows.map(async (r) => ({
          itemId: r.item_id as string,
          answer: (await decryptField(r.answer as string)) as BoundaryAnswer,
        })),
      );
    });
  }

  // --- ContentStore ---

  async addContentItem(item: ContentItemRecord): Promise<void> {
    // The DB CHECK constraints (§6, migrations/0002) enforce the invariants and
    // throw on violation — a failed insert, exactly as required.
    await this.db.query(
      `insert into content_items
         (id, title, category, description, intensity, difficulty, tags, safety_notes, source, licence, reviewed_by, reviewed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        item.id,
        item.title,
        item.category,
        item.description,
        item.intensity,
        item.difficulty,
        item.tags,
        item.safetyNotes,
        item.source,
        item.licence,
        item.reviewedBy,
        item.reviewedAt,
      ],
    );
  }

  async getContentItem(id: string): Promise<ContentItemRecord | null> {
    const { rows } = await this.db.query<Row>('select * from content_items where id = $1', [id]);
    return rows[0] ? mapContent(rows[0]) : null;
  }

  async getAllContentItems(): Promise<ContentItemRecord[]> {
    const { rows } = await this.db.query<Row>('select * from content_items');
    return rows.map(mapContent);
  }

  async getShippableContentItems(): Promise<ContentItemRecord[]> {
    const { rows } = await this.db.query<Row>('select * from shippable_content');
    return rows.map(mapContent);
  }

  async markContentReviewed(id: string, reviewedBy: string, reviewedAt: Date): Promise<void> {
    await this.db.query(
      'update content_items set reviewed_by = $2, reviewed_at = $3 where id = $1',
      [id, reviewedBy, reviewedAt],
    );
  }
}

/**
 * Production wiring sketch (needs the `pg` dependency):
 *
 *   import { Pool } from 'pg';
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const db: Db = {
 *     query: (text, params) => pool.query(text, params),
 *     transaction: async (fn) => {
 *       const client = await pool.connect();
 *       try {
 *         await client.query('begin');
 *         const r = await fn({ query: (t, p) => client.query(t, p) });
 *         await client.query('commit');
 *         return r;
 *       } catch (e) { await client.query('rollback'); throw e; }
 *       finally { client.release(); }
 *     },
 *   };
 *   export const store = new PgStore(db);
 *
 * The app must connect as a non-BYPASSRLS application role so the RLS policies
 * in migrations/0004 and 0005 are enforced.
 */
