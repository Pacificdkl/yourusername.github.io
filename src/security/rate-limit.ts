/**
 * Minimal in-memory fixed-window rate limiter (security-review medium finding).
 * Used to throttle brute-forceable endpoints: PIN verification, invite redeem,
 * and magic-link requests.
 *
 * In-memory means per-instance; a multi-instance production deployment needs a
 * shared store (Redis) — tracked in the security review. The interface here
 * stays the same either way.
 */
import { json } from '@/auth';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  const allowed = b.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - b.count),
    retryAfterMs: allowed ? 0 : b.resetAt - now,
  };
}

/** Best-effort client key from proxy headers (falls back to a constant). */
export function clientKey(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Enforce a limit; returns a 429 Response if exceeded, else null so the caller
 * can proceed.
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number): Response | null {
  const result = rateLimit(key, limit, windowMs);
  if (result.allowed) return null;
  return json({ error: 'rate_limited' }, 429, {
    'retry-after': String(Math.ceil(result.retryAfterMs / 1000)),
  });
}

/** Test-only: clear all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
}
