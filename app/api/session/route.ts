import { json, withVerified } from '@/auth';
import { getActiveSessionView } from '@/session';

export const runtime = 'nodejs';

/** GET /api/session — the caller's active session view, or null. */
export const GET = withVerified(async (_req, { user }) => {
  return json({ session: await getActiveSessionView(user.id) });
});
