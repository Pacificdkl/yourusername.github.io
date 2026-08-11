/**
 * The verification gate (non-negotiable #1: no content before verification).
 *
 * Two layers, both server-side:
 *  - `withVerified(handler)` — the per-route check EVERY data route must use.
 *    It resolves the session, loads the user from the store, and returns 403
 *    unless `ageVerified === true`. Because it looks the user up fresh, a
 *    session cookie can never assert verified status on its own.
 *  - `isGatedPath` / `edgeGateAllows` — the coarse check used by root
 *    middleware to reject unverified traffic at the edge before a handler runs.
 *
 * The two are redundant on purpose: middleware is the blanket, `withVerified`
 * is the guarantee. The invariant test (tests/invariants/01-gate.test.ts) calls
 * route handlers directly — bypassing middleware — so any data route that
 * forgets `withVerified` fails the suite.
 */

import { store } from '@/db';
import type { User } from '@/db';
import { getSession } from './session';

/** Standard JSON response helper. Error bodies never disclose why (invariant #5). */
export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export interface VerifiedContext {
  user: User;
}

type RouteHandler = (req: Request, ctx: VerifiedContext & { params?: unknown }) => Promise<Response> | Response;

/** Resolves the verified user for a request, or null if not verified. */
export async function getVerifiedUser(req: Request): Promise<User | null> {
  const session = await getSession(req);
  if (!session) return null;
  const user = await store.findUser(session.userId);
  if (!user || !user.ageVerified) return null;
  return user;
}

/**
 * Wraps a data-route handler so it only runs for verified users. Unverified or
 * unauthenticated requests get a bare 403 with no content and no reason.
 */
export function withVerified(handler: RouteHandler) {
  return async (req: Request, routeCtx?: { params?: unknown }): Promise<Response> => {
    const user = await getVerifiedUser(req);
    if (!user) {
      return json({ error: 'verification_required' }, 403);
    }
    return handler(req, { user, params: routeCtx?.params });
  };
}

type SessionRouteHandler = (
  req: Request,
  ctx: { userId: string; params?: unknown },
) => Promise<Response> | Response;

/**
 * Wraps a handler that needs a logged-in user but NOT verification — e.g. the
 * passkey-registration and verification-start flows, which run after login but
 * before the age check. Unauthenticated requests get 401.
 */
export function withSession(handler: SessionRouteHandler) {
  return async (req: Request, routeCtx?: { params?: unknown }): Promise<Response> => {
    const session = await getSession(req);
    if (!session) return json({ error: 'authentication_required' }, 401);
    return handler(req, { userId: session.userId, params: routeCtx?.params });
  };
}

/**
 * Path prefixes that are reachable WITHOUT verification: the auth flows and the
 * verification flow itself (you cannot become verified if the gate blocks the
 * callback), plus static/assets. Everything else under the app is gated.
 */
const UNGATED_PREFIXES = [
  '/api/auth/', // passkey + magic-link
  '/api/verify/', // start + provider callback
  '/verify', // the verification screen
  '/login', // the login screen
];

/** True if `pathname` is a route the gate must protect. */
export function isGatedPath(pathname: string): boolean {
  if (UNGATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return false;
  // Gate all API data routes; page routes are gated too, but the UI layer also
  // redirects. Static assets (_next, favicon, …) are excluded by the matcher.
  return pathname.startsWith('/api/') || pathname === '/' || pathname.startsWith('/app');
}

/**
 * Coarse edge decision for middleware. Only checks that a valid session exists;
 * the authoritative `ageVerified` check is `withVerified` at the route (the
 * store isn't reachable from Edge). Returns true to allow the request onward.
 */
export async function edgeGateAllows(req: Request): Promise<boolean> {
  const session = await getSession(req);
  return session !== null;
}
