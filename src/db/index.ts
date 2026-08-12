/**
 * Store composition root. A single module-level singleton so request handlers
 * and tests share one instance.
 *
 * The in-memory store backs dev/tests. The PostgreSQL adapter (`PgStore`,
 * src/db/pg-store.ts) is the production path; wire it to a `pg.Pool` per the
 * sketch in that file and connect as a non-BYPASSRLS application role so the RLS
 * policies (migrations/0004, 0005) are enforced. `DATABASE_URL` selects it in
 * production — see `pgPoolToDb` note. Production must NOT run the in-memory
 * store (its "at rest" is a process Map with no RLS).
 */
import { MemoryUserStore } from './memory-store';
import { PgStore } from './pg-store';
import { dbFromEnv } from './pg-pool';
import type { UserStore, PairingStore, BoundaryStore, ContentStore } from './types';

export type {
  UserStore,
  PairingStore,
  BoundaryStore,
  ContentStore,
  User,
  StoredCredential,
  VerificationRecord,
  Pairing,
  PairingStatus,
  InviteCode,
  SessionRow,
  SessionDrawRow,
  UnpairResult,
  BoundaryAnswer,
  BoundaryAnswerRow,
  ContentCategory,
  ContentItemRecord,
} from './types';

export type Store = UserStore & PairingStore & BoundaryStore & ContentStore;

export { PgStore, type Db, type Queryable } from './pg-store';
export { poolToDb, dbFromEnv } from './pg-pool';

/**
 * Selects the store: PostgreSQL when DATABASE_URL is set, otherwise in-memory.
 * The in-memory store must NOT run at production runtime (its "at rest" is a
 * process Map with no RLS), so we refuse it there — except during the Next
 * production BUILD, which evaluates modules without a database.
 */
function selectStore(): Store {
  if (process.env.DATABASE_URL) return new PgStore(dbFromEnv());

  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (process.env.NODE_ENV === 'production' && !isBuild) {
    throw new Error(
      'DATABASE_URL is required at production runtime; the in-memory store must not be used.',
    );
  }
  return new MemoryUserStore();
}

const globalForStore = globalThis as unknown as { __spinStore?: Store };

export const store: Store =
  globalForStore.__spinStore ?? (globalForStore.__spinStore = selectStore());

/** Test-only: reset the in-memory store. No-op for non-memory stores. */
export function __resetStore(): void {
  if (store instanceof MemoryUserStore) store.__reset();
}
