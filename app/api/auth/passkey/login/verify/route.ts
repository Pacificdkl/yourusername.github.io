import {
  json,
  signSession,
  sessionCookieHeader,
  finishAuthentication,
  emailHash,
} from '@/auth';
import { store } from '@/db';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export const runtime = 'nodejs';

/**
 * POST /api/auth/passkey/login/verify  { email, response }
 * Verifies a passkey assertion and starts a session.
 */
export async function POST(req: Request): Promise<Response> {
  const { email, response } = (await req.json().catch(() => ({}))) as {
    email?: string;
    response?: AuthenticationResponseJSON;
  };
  if (!email || !response) return json({ error: 'invalid_request' }, 400);

  const userId = await store.findUserIdByEmailHash(await emailHash(email));
  if (!userId) return json({ error: 'invalid_request' }, 400);

  const { verified } = await finishAuthentication(userId, response);
  if (!verified) return json({ verified: false }, 400);

  const session = await signSession(userId);
  return json({ verified: true }, 200, { 'set-cookie': sessionCookieHeader(session) });
}
