import { json } from '@/auth';
import { withConsent } from '@/consent';
import { getActiveSessionView } from '@/session';

export const runtime = 'nodejs';

/** GET /api/session — the caller's active session view, or null. */
export const GET = withConsent(async (_req, { user }) => {
  return json({ session: await getActiveSessionView(user.id) });
});
