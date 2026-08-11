import { json, signSession, sessionCookieHeader, consumeMagicLink } from '@/auth';

export const runtime = 'nodejs';

/**
 * POST /api/auth/magic/consume  { token }
 * Consumes a single-use magic-link token and starts a session. Consumption is
 * atomic in the store, so a token cannot be replayed.
 */
export async function POST(req: Request): Promise<Response> {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return json({ error: 'invalid_token' }, 400);

  const userId = await consumeMagicLink(token);
  if (!userId) return json({ error: 'invalid_token' }, 400);

  const session = await signSession(userId);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookieHeader(session) });
}
