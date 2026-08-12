/**
 * CSRF protection via same-origin checking (security-review medium finding).
 *
 * Session cookies are `SameSite=Lax`, which already blocks most cross-site
 * sub-requests, but state-changing requests should additionally require a
 * same-origin `Origin` (or `Referer`). Applied in `middleware.ts` for mutating
 * `/api` requests. Pure and edge-safe so it can run in middleware and be tested
 * directly.
 */

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutating(method: string): boolean {
  return MUTATING.has(method.toUpperCase());
}

function hostOf(urlOrOrigin: string): string | null {
  try {
    return new URL(urlOrOrigin).host;
  } catch {
    return null;
  }
}

/**
 * True if the request may proceed. Safe methods always pass. Mutating requests
 * must carry an `Origin` (or `Referer`) whose host matches the request host.
 */
export function originAllowed(
  method: string,
  originHeader: string | null,
  refererHeader: string | null,
  requestHost: string,
): boolean {
  if (!isMutating(method)) return true;
  const candidate = originHeader ?? refererHeader;
  if (!candidate) return false; // browsers send Origin on mutating requests
  const h = hostOf(candidate);
  return h !== null && h === requestHost;
}
