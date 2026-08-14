import { json, withSession, startRegistration } from '@/auth';

export const runtime = 'nodejs';

/** POST /api/auth/passkey/register/options — options to add a passkey (needs session). */
export const POST = withSession(async (_req, { userId }) => {
  const options = await startRegistration(userId);
  return json(options);
});
