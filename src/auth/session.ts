/**
 * Session cookies. A session asserts only "this request is user X" — it does
 * NOT assert verification. The gate re-checks `ageVerified` from the store on
 * every request, so a freshly-verified (or de-verified) user takes effect
 * immediately and the cookie can never forge verified status.
 *
 * Signed with HMAC-SHA256 over `userId.exp` using SESSION_SECRET, via Web
 * Crypto so the same code runs in Node route handlers and Edge middleware.
 */

const COOKIE_NAME = 'spin_session';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();

export interface SessionPayload {
  userId: string;
  /** epoch ms */
  exp: number;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET is unset or too short in production.');
    }
    // Dev/test fallback — deterministic, never used in production.
    return 'dev-only-insecure-session-secret';
  }
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return b64url(sig);
}

/** Constant-time-ish string compare (avoids early-exit timing leak). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Creates a signed session token for `userId`. */
export async function signSession(userId: string, ttlMs = DEFAULT_TTL_MS): Promise<string> {
  const exp = Date.now() + ttlMs;
  const body = `${userId}.${exp}`;
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

/** Verifies a token; returns the payload or null if invalid/expired. */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expRaw, sig] = parts as [string, string, string];
  const expected = await hmac(`${userId}.${expRaw}`);
  if (!safeEqual(sig, expected)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return { userId, exp };
}

/** Parses the session token out of a request's Cookie header. */
export function readSessionCookie(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE_NAME) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Resolves the signed session payload for a request, or null. */
export async function getSession(req: Request): Promise<SessionPayload | null> {
  return verifySession(readSessionCookie(req));
}

/** Builds the Set-Cookie header value for a session token. */
export function sessionCookieHeader(token: string, ttlMs = DEFAULT_TTL_MS): string {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(ttlMs / 1000)}`,
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs.join('; ');
}

/** Set-Cookie value that clears the session (used on logout / unpair). */
export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
