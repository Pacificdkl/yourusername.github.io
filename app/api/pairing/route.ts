import { json, withVerified } from '@/auth';
import { getPairingView } from '@/pairing';

export const runtime = 'nodejs';

/**
 * GET /api/pairing — the caller's current pairing (partner id + status), or
 * null. Carries no boundary data (invariant #5); those are per-user and read
 * elsewhere in Phase 3.
 */
export const GET = withVerified(async (_req, { user }) => {
  const view = await getPairingView(user.id);
  return json({ pairing: view });
});
