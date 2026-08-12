/**
 * The Article 9 consent gate (CLAUDE.md §7.8). `withConsent` composes the
 * verification gate with an explicit-consent check: the handler runs only for a
 * user who is BOTH age-verified AND has given current Article 9 consent.
 *
 * It builds on `getVerifiedUser`, so verification is still enforced server-side
 * (the §9 merge checklist counts this as a verified route). A verified user
 * without consent gets 403 `consent_required` — distinct from the unverified
 * 403 so the client can route to the consent screen rather than verification.
 */

import { getVerifiedUser, json } from '@/auth';
import type { User } from '@/db';
import { hasConsent } from './service';

type ConsentRouteHandler = (
  req: Request,
  ctx: { user: User; params?: unknown },
) => Promise<Response> | Response;

export function withConsent(handler: ConsentRouteHandler) {
  return async (req: Request, routeCtx?: { params?: unknown }): Promise<Response> => {
    const user = await getVerifiedUser(req);
    if (!user) return json({ error: 'verification_required' }, 403);
    if (!(await hasConsent(user.id))) return json({ error: 'consent_required' }, 403);
    return handler(req, { user, params: routeCtx?.params });
  };
}
