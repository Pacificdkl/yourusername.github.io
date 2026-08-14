import { json, withSession } from '@/auth';
import { getProvider } from '@/verify';

export const runtime = 'nodejs';

/**
 * POST /api/verify/start — begins an age-assurance check for the logged-in user
 * and returns the provider handoff. Reachable pre-verification (it is how a user
 * becomes verified).
 */
export const POST = withSession(async (_req, { userId }) => {
  const provider = getProvider();
  const session = await provider.start(userId);
  return json({ redirectUrl: session.redirectUrl, sessionRef: session.sessionRef });
});
