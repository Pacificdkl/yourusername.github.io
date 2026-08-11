import { json, withVerified } from '@/auth';
import { endSession } from '@/session';

export const runtime = 'nodejs';

/** POST /api/session/end — end the active session. */
export const POST = withVerified(async (_req, { user }) => {
  const result = await endSession(user.id);
  return json({ ended: result.ok });
});
