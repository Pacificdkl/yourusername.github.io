import { json } from '@/auth';
import { withConsent } from '@/consent';
import { endSession } from '@/session';

export const runtime = 'nodejs';

/** POST /api/session/end — end the active session. */
export const POST = withConsent(async (_req, { user }) => {
  const result = await endSession(user.id);
  return json({ ended: result.ok });
});
