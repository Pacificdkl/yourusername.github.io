/**
 * Store composition root. A single module-level singleton so request handlers
 * and tests share one instance.
 *
 * Phase 1 always uses the in-memory store. When the pg adapter lands, select it
 * here by DATABASE_URL and refuse the in-memory store in production.
 */
import { MemoryUserStore } from './memory-store';
import type { UserStore } from './types';

export type { UserStore, User, StoredCredential, VerificationRecord } from './types';

const globalForStore = globalThis as unknown as { __spinStore?: UserStore };

export const store: UserStore =
  globalForStore.__spinStore ?? (globalForStore.__spinStore = new MemoryUserStore());

/** Test-only: reset the in-memory store. No-op for non-memory stores. */
export function __resetStore(): void {
  if (store instanceof MemoryUserStore) store.__reset();
}
