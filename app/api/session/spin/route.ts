import { json, withVerified } from '@/auth';
import { spin } from '@/session';

export const runtime = 'nodejs';

/**
 * POST /api/session/spin — draw one item from the filtered pool. Returns the
 * drawn item, or `item: null` when the pool is exhausted. The result card is
 * built from this (Phase 6).
 */
export const POST = withVerified(async (_req, { user }) => {
  const result = await spin(user.id);
  if (!result.ok) return json({ error: result.reason }, 409);
  return json({ item: result.item });
});
