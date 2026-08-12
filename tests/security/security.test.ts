/**
 * Security hardening (security-review medium findings): rate limiting, CSRF
 * same-origin checks, and the strict Content-Security-Policy.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, enforceRateLimit, __resetRateLimits } from '@/security/rate-limit';
import { originAllowed, isMutating } from '@/security/csrf';
import { __resetStore, store } from '@/db';
import { signSession, SESSION_COOKIE_NAME } from '@/auth';
import { setPin } from '@/privacy';
import { POST as pinVerify } from '../../app/api/privacy/pin/verify/route';
// next.config.mjs is plain JS with no type declaration.
// @ts-expect-error untyped module
import nextConfigModule from '../../next.config.mjs';

interface HeaderEntry {
  key: string;
  value: string;
}
interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}
const nextConfig = nextConfigModule as unknown as { headers: () => Promise<HeaderRule[]> };

describe('rate limiter', () => {
  beforeEach(() => __resetRateLimits());

  it('allows up to the limit, then blocks', () => {
    for (let i = 0; i < 3; i++) expect(rateLimit('k', 3, 60_000).allowed).toBe(true);
    const blocked = rateLimit('k', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('enforceRateLimit returns a 429 once exceeded', () => {
    for (let i = 0; i < 2; i++) expect(enforceRateLimit('x', 2, 60_000)).toBeNull();
    const res = enforceRateLimit('x', 2, 60_000);
    expect(res?.status).toBe(429);
  });
});

describe('CSRF same-origin', () => {
  it('allows safe methods regardless of origin', () => {
    expect(isMutating('GET')).toBe(false);
    expect(originAllowed('GET', null, null, 'spin.example')).toBe(true);
  });

  it('allows same-origin mutations', () => {
    expect(originAllowed('POST', 'https://spin.example', null, 'spin.example')).toBe(true);
  });

  it('blocks cross-origin and origin-less mutations', () => {
    expect(originAllowed('POST', 'https://evil.example', null, 'spin.example')).toBe(false);
    expect(originAllowed('POST', null, null, 'spin.example')).toBe(false);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(originAllowed('POST', null, 'https://spin.example/x', 'spin.example')).toBe(true);
  });
});

describe('Content-Security-Policy', () => {
  it('is set, self-only, and frames are denied', async () => {
    const headers = await nextConfig.headers();
    const values = headers.flatMap((h) => h.headers);
    const csp = values.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/https?:\/\//); // no external origins (#8)
  });
});

describe('PIN verify is rate-limited', () => {
  beforeEach(() => {
    __resetStore();
    __resetRateLimits();
  });

  it('returns 429 after too many attempts', async () => {
    const u = await store.createUser();
    await store.markVerified(u.id, { providerRef: 'r', verifiedAt: new Date() });
    await setPin(u.id, '1234');
    const cookie = `${SESSION_COOKIE_NAME}=${await signSession(u.id)}`;
    const req = () =>
      new Request('http://localhost/api/privacy/pin/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ pin: '0000' }),
      });

    for (let i = 0; i < 5; i++) {
      const res = await pinVerify(req());
      expect(res.status).toBe(200); // wrong pin, but allowed
    }
    const blocked = await pinVerify(req());
    expect(blocked.status).toBe(429);
  });
});
