import { json, withVerified, clearSessionCookieHeader } from '@/auth';
import { deleteAccount } from '@/privacy';

export const runtime = 'nodejs';

/**
 * POST /api/privacy/delete — TRUE delete of the caller's account and all their
 * data (§7.7), then clears the session cookie. Irreversible.
 */
export const POST = withVerified(async (_req, { user }) => {
  await deleteAccount(user.id);
  return json({ deleted: true }, 200, { 'set-cookie': clearSessionCookieHeader() });
});
