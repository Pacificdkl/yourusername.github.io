import { json } from '@/auth';
import { withConsent } from '@/consent';
import { getPoolForUser } from '@/boundaries';
import type { PoolMode } from '@/boundaries';

export const runtime = 'nodejs';

const MODES: readonly PoolMode[] = ['both-yes', 'yes-and-maybe', 'maybe-and-maybe'];
function parseMode(v: string | null): PoolMode {
  return (MODES as readonly string[]).includes(v ?? '') ? (v as PoolMode) : 'both-yes';
}

/**
 * GET /api/boundaries/pool?mode= — the shared pool for the caller's active
 * pairing, as item ids ONLY (invariant #5). No pairing → 409 not_paired, which
 * discloses no boundary data. This is the single shared read.
 */
export const GET = withConsent(async (req, { user }) => {
  const mode = parseMode(new URL(req.url).searchParams.get('mode'));
  const result = await getPoolForUser(user.id, mode);
  if (!result.ok) return json({ error: result.reason }, 409);
  return json({ pool: result.pool });
});
