import { json, withVerified } from '@/auth';
import { redeemInvite } from '@/pairing';
import { enforceRateLimit } from '@/security/rate-limit';

export const runtime = 'nodejs';

/** POST /api/pairing/redeem  { code } — consume an invite → pending pairing (gated). */
export const POST = withVerified(async (req, { user }) => {
  // Throttle invite-code guessing.
  const limited = enforceRateLimit(`redeem:${user.id}`, 10, 15 * 60 * 1000);
  if (limited) return limited;

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code) return json({ error: 'invalid_code' }, 400);

  const result = await redeemInvite(code.trim().toUpperCase(), user.id);
  if (!result.ok) {
    const status = result.reason === 'invalid_code' ? 400 : 409;
    return json({ error: result.reason }, status);
  }
  return json({ pairingId: result.pairingId, status: result.status });
});
