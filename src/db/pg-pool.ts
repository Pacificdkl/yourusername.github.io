/**
 * Production wiring for the PostgreSQL adapter (ADR 0015): a `pg.Pool` adapted
 * to the `Db` interface `PgStore` depends on.
 *
 * Transactions acquire a dedicated client from the pool and run BEGIN/…/COMMIT
 * on it, so `SET LOCAL app.current_user` (used by RLS-scoped operations) stays
 * on the same connection. The app must connect as a NON-BYPASSRLS application
 * role for the row-level security policies (migrations/0004, 0005) to be
 * enforced.
 */
import { Pool, type PoolConfig } from 'pg';
import type { Db } from './pg-store';

export function poolToDb(pool: Pool): Db {
  return {
    // pg constrains its row generic to QueryResultRow; the Db interface is
    // deliberately looser, so cast at this single boundary.
    query: (text, params) => pool.query(text, params as unknown[]) as never,
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn({ query: (t, p) => client.query(t, p as unknown[]) as never });
        await client.query('commit');
        return result;
      } catch (err) {
        await client.query('rollback');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

/**
 * Builds a `Db` from `DATABASE_URL`. The connecting role should be a dedicated
 * application role WITHOUT BYPASSRLS. Pool tuning (max, timeouts) can be layered
 * on via `extra`.
 */
export function dbFromEnv(extra: Omit<PoolConfig, 'connectionString'> = {}): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  return poolToDb(new Pool({ connectionString, ...extra }));
}
