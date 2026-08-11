import { json, getSession } from '@/auth';
import { store } from '@/db';

export const runtime = 'nodejs';

/**
 * GET /api/auth/session — the current session's own status, used by the UI to
 * decide where to route (login → verify → app). Reachable pre-verification.
 * Reveals ONLY the caller's own status; never another user's.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession(req);
  if (!session) return json({ authenticated: false, ageVerified: false });
  const user = await store.findUser(session.userId);
  return json({
    authenticated: Boolean(user),
    ageVerified: Boolean(user?.ageVerified),
  });
}
