/**
 * Edge middleware — the blanket half of the verification gate (non-negotiable
 * #1). It rejects requests without a valid session before any handler runs.
 *
 * It intentionally does NOT check `ageVerified` (the store is not reachable from
 * the Edge runtime); that authoritative check is `withVerified` at each data
 * route. Middleware imports only the session verifier so it stays edge-safe and
 * never pulls the store into the edge bundle.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/auth/session';
import { originAllowed } from '@/security/csrf';

const UNGATED_PREFIXES = ['/api/auth/', '/api/verify/', '/verify', '/login'];

function isUngated(pathname: string): boolean {
  return UNGATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // CSRF: mutating /api requests must be same-origin. Runs first so even the
  // ungated auth-flow mutations are protected.
  if (pathname.startsWith('/api/')) {
    const csrfOk = originAllowed(
      req.method,
      req.headers.get('origin'),
      req.headers.get('referer'),
      req.nextUrl.host,
    );
    if (!csrfOk) {
      return new NextResponse(JSON.stringify({ error: 'csrf_check_failed' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  if (isUngated(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(token);

  if (!session) {
    // API callers get a 403; page navigations are sent to the verification/login screen.
    if (pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'verification_required' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/verify';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Gate everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)'],
};
