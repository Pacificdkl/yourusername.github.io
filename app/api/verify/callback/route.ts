import { json, withSession } from '@/auth';
import { verifyAndPersist } from '@/verify';

export const runtime = 'nodejs';

/**
 * POST /api/verify/callback — provider callback. Reduces the provider payload to
 * the minimal result and persists ONLY age_verified/provider_ref/verified_at
 * (non-negotiable #2, enforced in verifyAndPersist).
 *
 * Phase 1 uses the session-bound stub flow (the returning user carries their
 * session). A real provider's server-to-server webhook has no session and is
 * authenticated by signature instead — see the provider adapter's
 * handleCallback and docs/decisions/0006-phase-1-auth-gate.md.
 */
export const POST = withSession(async (req, { userId }) => {
  const rawBody = await req.json().catch(() => ({}));
  const signature = req.headers.get('x-provider-signature');
  const { ageVerified } = await verifyAndPersist(userId, rawBody, signature);
  return json({ ageVerified });
});
