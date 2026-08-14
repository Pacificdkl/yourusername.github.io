import { json, withVerified } from '@/auth';
import { confirmPairing } from '@/pairing';

export const runtime = 'nodejs';

/** POST /api/pairing/confirm  { pairingId } — confirm a pending pairing (gated). */
export const POST = withVerified(async (req, { user }) => {
  const { pairingId } = (await req.json().catch(() => ({}))) as { pairingId?: string };
  if (!pairingId) return json({ error: 'not_found' }, 400);

  const result = await confirmPairing(pairingId, user.id);
  if (!result.ok) {
    // 'not_a_member' is treated as not-found so membership isn't disclosed.
    const status = result.reason === 'already_ended' ? 409 : 404;
    return json({ error: result.reason === 'not_a_member' ? 'not_found' : result.reason }, status);
  }
  return json({ status: result.status });
});
