import { json, withVerified } from '@/auth';
import { createInvite } from '@/pairing';

export const runtime = 'nodejs';

/** POST /api/pairing/invite — issue a single-use invite code (gated). */
export const POST = withVerified(async (_req, { user }) => {
  const result = await createInvite(user.id);
  if (!result.ok) return json({ error: result.reason }, 409);
  return json({ code: result.code, expiresAt: result.expiresAt });
});
