import { json } from '@/auth';
import { withConsent } from '@/consent';
import { startSession } from '@/session';

export const runtime = 'nodejs';

/**
 * POST /api/session/start  { intensityCap?, noRepeat? } — start (or resume) the
 * pairing's spin session. Gated; requires an active pairing.
 */
export const POST = withConsent(async (req, { user }) => {
  const body = (await req.json().catch(() => ({}))) as {
    intensityCap?: number;
    noRepeat?: boolean;
  };
  const config: { intensityCap?: number; noRepeat?: boolean } = {};
  if (typeof body.intensityCap === 'number') config.intensityCap = body.intensityCap;
  if (typeof body.noRepeat === 'boolean') config.noRepeat = body.noRepeat;

  const result = await startSession(user.id, config);
  if (!result.ok) return json({ error: result.reason }, 409);
  return json({ session: result.session });
});
