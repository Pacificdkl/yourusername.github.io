import { json, withVerified } from '@/auth';
import { verifyPin } from '@/privacy';
import { enforceRateLimit } from '@/security/rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/privacy/pin/verify  { pin } — unlock check for the app lock.
 * Returns only a boolean; the error shape never distinguishes "no PIN set" from
 * "wrong PIN". Rate-limited to resist PIN brute force.
 */
export const POST = withVerified(async (req, { user }) => {
  const limited = enforceRateLimit(`pin-verify:${user.id}`, 5, 15 * 60 * 1000);
  if (limited) return limited;

  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin) return json({ ok: false }, 200);
  return json({ ok: await verifyPin(user.id, pin) });
});
