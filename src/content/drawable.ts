/**
 * The drawable pool: the intersection of what both partners consented to
 * (boundaries) AND what has passed review (content). This is the "pool query"
 * §6 refers to — unreviewed rows must never reach the draw — so the review
 * guard is applied here, before the spin engine ever sees the array (#3).
 */

import { getPoolForUser } from '@/boundaries';
import type { PoolMode } from '@/boundaries';
import { getShippableItemIds } from './service';

export type DrawablePoolResult =
  | { ok: true; pool: string[] }
  | { ok: false; reason: 'not_paired' };

export async function getDrawablePoolForUser(
  userId: string,
  mode: PoolMode = 'both-yes',
): Promise<DrawablePoolResult> {
  const consented = await getPoolForUser(userId, mode);
  if (!consented.ok) return { ok: false, reason: consented.reason };

  const shippable = await getShippableItemIds();
  return { ok: true, pool: consented.pool.filter((id) => shippable.has(id)) };
}
