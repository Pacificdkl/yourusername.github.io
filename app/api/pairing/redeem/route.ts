import { json, withVerified } from '@/auth';
import { redeemInvite } from '@/pairing';

export const runtime = 'nodejs';

/** POST /api/pairing/redeem  { code } — consume an invite → pending pairing (gated). */
export const POST = withVerified(async (req, { user }) => {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code) return json({ error: 'invalid_code' }, 400);

  const result = await redeemInvite(code.trim().toUpperCase(), user.id);
  if (!result.ok) {
    const status = result.reason === 'invalid_code' ? 400 : 409;
    return json({ error: result.reason }, status);
  }
  return json({ pairingId: result.pairingId, status: result.status });
});
