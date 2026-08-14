import { json, startAuthentication, emailHash } from '@/auth';
import { store } from '@/db';

export const runtime = 'nodejs';

/**
 * POST /api/auth/passkey/login/options  { email }
 * Issues authentication options scoped to the user's registered passkeys.
 * Returns generic options even when the email is unknown, to avoid enumeration.
 */
export async function POST(req: Request): Promise<Response> {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email || !email.includes('@')) return json({ error: 'invalid_email' }, 400);

  const userId = await store.findUserIdByEmailHash(await emailHash(email));
  if (!userId) {
    // No account: return a syntactically valid challenge with no credentials so
    // the response shape does not reveal whether the account exists.
    return json(await startAuthentication('unknown'));
  }
  return json(await startAuthentication(userId));
}
