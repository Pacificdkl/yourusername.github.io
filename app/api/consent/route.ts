import { json, withVerified } from '@/auth';
import { getConsent, grantConsent, withdrawConsent } from '@/consent';

export const runtime = 'nodejs';

/**
 * Article 9 explicit consent (§7.8), SEPARATE from T&Cs. These routes are gated
 * by verification only (not by consent — this is where consent is given), so a
 * verified user can reach the consent screen.
 */

/** GET /api/consent — the caller's consent status. */
export const GET = withVerified(async (_req, { user }) => {
  return json({ consent: await getConsent(user.id) });
});

/**
 * POST /api/consent  { granted: boolean, version } — grant or withdraw.
 * Requires an explicit `granted: true` and the current version, so consent is
 * unambiguous and specific (never bundled or defaulted).
 */
export const POST = withVerified(async (req, { user }) => {
  const { granted, version } = (await req.json().catch(() => ({}))) as {
    granted?: unknown;
    version?: unknown;
  };
  const current = (await getConsent(user.id)).currentVersion;

  if (granted === true) {
    if (version !== current) return json({ error: 'stale_version', currentVersion: current }, 409);
    await grantConsent(user.id);
    return json({ consent: await getConsent(user.id) });
  }
  if (granted === false) {
    await withdrawConsent(user.id);
    return json({ consent: await getConsent(user.id) });
  }
  return json({ error: 'explicit_choice_required' }, 400);
});
