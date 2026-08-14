import { json, withVerified } from '@/auth';
import { setPin, hasPin } from '@/privacy';

export const runtime = 'nodejs';

/** GET /api/privacy/pin — whether the caller has a PIN set. */
export const GET = withVerified(async (_req, { user }) => {
  return json({ hasPin: await hasPin(user.id) });
});

/** POST /api/privacy/pin  { pin } — set/replace the app-lock PIN (stored hashed). */
export const POST = withVerified(async (req, { user }) => {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin || !/^\d{4,10}$/.test(pin)) return json({ error: 'invalid_pin' }, 400);
  await setPin(user.id, pin);
  return json({ ok: true });
});
