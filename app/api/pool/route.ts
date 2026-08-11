import { json, withVerified } from '@/auth';
import { getDrawablePoolForUser } from '@/content';
import type { PoolMode } from '@/boundaries';

export const runtime = 'nodejs';

const MODES: readonly PoolMode[] = ['both-yes', 'yes-and-maybe', 'maybe-and-maybe'];
function parseMode(v: string | null): PoolMode {
  return (MODES as readonly string[]).includes(v ?? '') ? (v as PoolMode) : 'both-yes';
}

/**
 * GET /api/pool?mode= — the DRAWABLE pool: items both partners consented to AND
 * that have passed review. This is what the spin engine will draw from. Item
 * ids only (invariant #5); unreviewed items are excluded (§6 guard).
 */
export const GET = withVerified(async (req, { user }) => {
  const mode = parseMode(new URL(req.url).searchParams.get('mode'));
  const result = await getDrawablePoolForUser(user.id, mode);
  if (!result.ok) return json({ error: result.reason }, 409);
  return json({ pool: result.pool });
});
