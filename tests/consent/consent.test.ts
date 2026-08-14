/**
 * Article 9 explicit-consent gate (CLAUDE.md §7.8). A verified user must give
 * explicit, current consent before any special-category route runs; withdrawal
 * is immediate. Consent is a SEPARATE gate from age verification.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import { signSession, SESSION_COOKIE_NAME } from '@/auth';
import { CONSENT_VERSION, grantConsent, hasConsent, getConsent, withdrawConsent } from '@/consent';
import { GET as getContent } from '../../app/api/content/route';

async function verifiedUser(): Promise<string> {
  const u = await store.createUser();
  await store.markVerified(u.id, { providerRef: 'r', verifiedAt: new Date() });
  return u.id;
}
function req(cookie?: string): Request {
  return new Request('http://localhost/api/content', {
    headers: cookie ? { cookie } : {},
  });
}
async function cookie(userId: string): Promise<string> {
  return `${SESSION_COOKIE_NAME}=${await signSession(userId)}`;
}

describe('consent service', () => {
  beforeEach(() => __resetStore());

  it('is not granted by default; grant then withdraw', async () => {
    const a = await verifiedUser();
    expect(await hasConsent(a)).toBe(false);

    await grantConsent(a);
    expect(await hasConsent(a)).toBe(true);
    const status = await getConsent(a);
    expect(status.granted).toBe(true);
    expect(status.version).toBe(CONSENT_VERSION);
    expect(status.grantedAt).toBeInstanceOf(Date);

    await withdrawConsent(a);
    expect(await hasConsent(a)).toBe(false);
  });

  it('consent to an old version does not count as current consent', async () => {
    const a = await verifiedUser();
    await store.setConsent(a, 'ancient.v0', new Date());
    expect(await hasConsent(a)).toBe(false); // must match CONSENT_VERSION
    expect((await getConsent(a)).granted).toBe(false);
  });
});

describe('consent gate on a special-category route', () => {
  beforeEach(() => __resetStore());

  it('403 consent_required for a verified user without consent', async () => {
    const a = await verifiedUser();
    const res = await getContent(req(await cookie(a)));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe('consent_required');
  });

  it('allows access once consent is granted, and blocks again after withdrawal', async () => {
    const a = await verifiedUser();
    await grantConsent(a);
    const ok = await getContent(req(await cookie(a)));
    expect(ok.status).toBe(200);

    await withdrawConsent(a);
    const blocked = await getContent(req(await cookie(a)));
    expect(blocked.status).toBe(403);
  });

  it('unauthenticated still gets verification_required (verification enforced first)', async () => {
    const res = await getContent(req());
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe('verification_required');
  });
});
