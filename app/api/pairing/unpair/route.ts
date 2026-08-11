import { json, withVerified } from '@/auth';
import { unpair } from '@/pairing';

export const runtime = 'nodejs';

/**
 * POST /api/pairing/unpair — unilateral, instant unpair (non-negotiable #7).
 * No approval, no delay, and no notification to the other party: the response
 * reports only the caller's own outcome.
 */
export const POST = withVerified(async (_req, { user }) => {
  const { unpaired } = await unpair(user.id);
  return json({ unpaired });
});
