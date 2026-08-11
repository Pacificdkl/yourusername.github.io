/**
 * Boundaries service — the I/O layer over the pure pool computation.
 *
 * Invariant #5 (boundary opacity): the only cross-partner read exposed here is
 * `getPoolForUser`, which returns item ids only. `getMyAnswers` returns the
 * caller's own answers and nothing else; there is deliberately NO function that
 * returns a partner's answers.
 *
 * Invariant #3 / #4: the pool is produced by the pure `computePool`, which
 * filters before the spin engine ever draws and treats any `no` as absolute.
 */

import { store } from '@/db';
import type { BoundaryAnswerRow } from '@/db';
import { getPairingView } from '@/pairing';
import { computePool } from './pool';
import type { Answer, PoolMode } from './types';

/** Set or edit the caller's own answer for an item (instant; §7.3). */
export async function setAnswer(userId: string, itemId: string, answer: Answer): Promise<void> {
  await store.setBoundaryAnswer(userId, itemId, answer);
}

/** The caller's own answers. Never another user's (invariant #5). */
export async function getMyAnswers(userId: string): Promise<BoundaryAnswerRow[]> {
  return store.getBoundaryAnswers(userId);
}

/**
 * Pure helper: the shared pool ids from two partners' answers. An item is
 * considered only if BOTH partners have answered it; a missing answer means "no
 * consent yet" and the item is absent. Reuses the audited `computePool`.
 */
export function computeSharedPoolIds(
  aAnswers: readonly BoundaryAnswerRow[],
  bAnswers: readonly BoundaryAnswerRow[],
  mode: PoolMode = 'both-yes',
): string[] {
  const bByItem = new Map(bAnswers.map((r) => [r.itemId, r.answer]));
  const pairs = aAnswers
    .filter((r) => bByItem.has(r.itemId))
    .map((r) => ({ itemId: r.itemId, a: r.answer as Answer, b: bByItem.get(r.itemId) as Answer }));
  return computePool(pairs, mode);
}

export type PoolResult =
  | { ok: true; pool: string[] }
  | { ok: false; reason: 'not_paired' };

/**
 * The shared pool for the caller's active pairing. Requires an ACTIVE pairing;
 * a pending or absent pairing yields `not_paired` (no boundary data leaks
 * either way — invariant #5).
 */
export async function getPoolForUser(userId: string, mode: PoolMode = 'both-yes'): Promise<PoolResult> {
  const view = await getPairingView(userId);
  if (!view || view.status !== 'active') return { ok: false, reason: 'not_paired' };

  const [mine, theirs] = await Promise.all([
    store.getBoundaryAnswers(userId),
    store.getBoundaryAnswers(view.partnerId),
  ]);
  return { ok: true, pool: computeSharedPoolIds(mine, theirs, mode) };
}
