import { json, withVerified } from '@/auth';
import { verifyPin } from '@/privacy';

export const runtime = 'nodejs';

/**
 * POST /api/privacy/pin/verify  { pin } — unlock check for the app lock.
 * Returns only a boolean; the error shape never distinguishes "no PIN set" from
 * "wrong PIN".
 */
export const POST = withVerified(async (req, { user }) => {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin) return json({ ok: false }, 200);
  return json({ ok: await verifyPin(user.id, pin) });
});
