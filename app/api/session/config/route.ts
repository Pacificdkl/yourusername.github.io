import { json } from '@/auth';
import { withConsent } from '@/consent';
import { updateSessionConfig } from '@/session';
import { isCategory } from '@/content';
import type { ContentCategory } from '@/content';

export const runtime = 'nodejs';

/**
 * POST /api/session/config  { intensityCap?, noRepeat?, categories? } — update
 * the active session's controls (intensity slider / category selector). Takes
 * effect on the next spin.
 */
export const POST = withConsent(async (req, { user }) => {
  const body = (await req.json().catch(() => ({}))) as {
    intensityCap?: number;
    noRepeat?: boolean;
    categories?: unknown;
  };

  const config: { intensityCap?: number; noRepeat?: boolean; categories?: ContentCategory[] | null } = {};
  if (typeof body.intensityCap === 'number') config.intensityCap = body.intensityCap;
  if (typeof body.noRepeat === 'boolean') config.noRepeat = body.noRepeat;
  if (body.categories === null) config.categories = null;
  else if (Array.isArray(body.categories)) {
    config.categories = body.categories.filter(isCategory);
  }

  const result = await updateSessionConfig(user.id, config);
  if (!result.ok) return json({ error: result.reason }, 409);
  return json({ session: result.session });
});
