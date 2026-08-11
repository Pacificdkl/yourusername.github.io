import { json, clearSessionCookieHeader } from '@/auth';

export const runtime = 'nodejs';

/** POST /api/auth/logout — clears the session cookie. */
export async function POST(): Promise<Response> {
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookieHeader() });
}
