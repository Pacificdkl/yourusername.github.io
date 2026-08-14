import { json, withVerified } from '@/auth';

export const runtime = 'nodejs';

/**
 * GET /api/me — the caller's own profile. A gated DATA route: it runs only for
 * verified users (non-negotiable #1). Returns the user's own fields only, and
 * nothing about any pairing partner (invariant #5).
 */
export const GET = withVerified(async (_req, { user }) => {
  return json({
    id: user.id,
    ageVerified: user.ageVerified,
    verifiedAt: user.verifiedAt,
  });
});
