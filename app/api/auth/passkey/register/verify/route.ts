import { json, withSession, finishRegistration } from '@/auth';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export const runtime = 'nodejs';

/** POST /api/auth/passkey/register/verify  { response } — stores the new passkey. */
export const POST = withSession(async (req, { userId }) => {
  const { response } = (await req.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON;
  };
  if (!response) return json({ error: 'missing_response' }, 400);
  const { verified } = await finishRegistration(userId, response);
  return json({ verified }, verified ? 200 : 400);
});
