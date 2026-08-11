import { json } from '@/auth';
import { issueMagicLink } from '@/auth';

export const runtime = 'nodejs';

/**
 * POST /api/auth/magic/request  { email }
 * Issues a one-time magic link. Always returns { ok: true } regardless of
 * whether the email was seen before, to avoid account enumeration. In dev the
 * link is returned directly; in production it is emailed and never logged.
 */
export async function POST(req: Request): Promise<Response> {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email || !email.includes('@')) {
    return json({ error: 'invalid_email' }, 400);
  }

  const { token } = await issueMagicLink(email);
  const link = `${process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000'}/login/magic?token=${token}`;

  // TODO(phase-1+): send `link` via the email provider. Do NOT log it.
  const devLink = process.env.NODE_ENV === 'production' ? undefined : link;
  return json({ ok: true, devLink });
}
