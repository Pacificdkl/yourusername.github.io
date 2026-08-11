/**
 * Non-negotiable #5 — Boundary opacity.
 *
 * Partner A's per-item answers are never readable by Partner B through any
 * endpoint, response shape, or error message. The only shared read is the
 * resulting pool. Also covers §7.3's "instant effect on edit" and that a single
 * "no" excludes at every mode via the real endpoints.
 *
 * These drive the actual route handlers with signed sessions, like the gate and
 * identity tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import { signSession, SESSION_COOKIE_NAME } from '@/auth';
import { createInvite, redeemInvite, confirmPairing } from '@/pairing';
import { GET as getBoundaries, PUT as putBoundary } from '../../app/api/boundaries/route';
import { GET as getPool } from '../../app/api/boundaries/pool/route';

async function verifiedUser(): Promise<string> {
  const u = await store.createUser();
  await store.markVerified(u.id, { providerRef: 'r', verifiedAt: new Date() });
  return u.id;
}

async function cookieFor(userId: string): Promise<string> {
  return `${SESSION_COOKIE_NAME}=${await signSession(userId)}`;
}

async function pairActive(a: string, b: string): Promise<void> {
  const inv = await createInvite(a);
  if (!inv.ok) throw new Error(inv.reason);
  const red = await redeemInvite(inv.code, b);
  if (!red.ok) throw new Error(red.reason);
  const conf = await confirmPairing(red.pairingId, a);
  if (!conf.ok) throw new Error(conf.reason);
}

function put(cookie: string, body: unknown): Request {
  return new Request('http://localhost/api/boundaries', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
}
function get(url: string, cookie: string): Request {
  return new Request(`http://localhost${url}`, { headers: { cookie } });
}

describe('invariant #5: boundary opacity', () => {
  beforeEach(() => __resetStore());

  it('a user\'s boundaries read returns only their OWN answers', async () => {
    const [a, b] = [await verifiedUser(), await verifiedUser()];
    const [ca, cb] = [await cookieFor(a), await cookieFor(b)];
    await pairActive(a, b);

    await putBoundary(put(ca, { itemId: 'shared', answer: 'yes' }), undefined as never);
    await putBoundary(put(cb, { itemId: 'shared', answer: 'no' }), undefined as never);
    await putBoundary(put(cb, { itemId: 'only-b', answer: 'yes' }), undefined as never);

    const res = await getBoundaries(get('/api/boundaries', ca), undefined as never);
    const body = (await res.json()) as { answers: { itemId: string; answer: string }[] };

    // A sees only its own single answer.
    expect(body.answers).toEqual([{ itemId: 'shared', answer: 'yes' }]);
    // B's exclusive item and B's differing answer never appear in A's response.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('only-b');
  });

  it('the shared pool read returns item ids only — no per-side answers', async () => {
    const [a, b] = [await verifiedUser(), await verifiedUser()];
    const [ca, cb] = [await cookieFor(a), await cookieFor(b)];
    await pairActive(a, b);

    await putBoundary(put(ca, { itemId: 'x', answer: 'yes' }), undefined as never);
    await putBoundary(put(cb, { itemId: 'x', answer: 'yes' }), undefined as never);
    await putBoundary(put(ca, { itemId: 'y', answer: 'yes' }), undefined as never);
    await putBoundary(put(cb, { itemId: 'y', answer: 'no' }), undefined as never); // B excludes y

    const res = await getPool(get('/api/boundaries/pool', ca), undefined as never);
    const body = (await res.json()) as { pool: unknown };

    expect(Array.isArray(body.pool)).toBe(true);
    expect(body.pool).toEqual(['x']); // y excluded by B's "no"
    for (const entry of body.pool as unknown[]) expect(typeof entry).toBe('string');
    // The excluded item and any "which side" hint are absent — no reason field.
    expect(Object.keys(body)).toEqual(['pool']);
    expect(JSON.stringify(body)).not.toContain('answer');
  });

  it('editing an answer changes the pool immediately (§7.3)', async () => {
    const [a, b] = [await verifiedUser(), await verifiedUser()];
    const [ca, cb] = [await cookieFor(a), await cookieFor(b)];
    await pairActive(a, b);

    await putBoundary(put(ca, { itemId: 'x', answer: 'yes' }), undefined as never);
    await putBoundary(put(cb, { itemId: 'x', answer: 'yes' }), undefined as never);

    let body = (await (await getPool(get('/api/boundaries/pool', ca), undefined as never)).json()) as {
      pool: string[];
    };
    expect(body.pool).toEqual(['x']);

    // A edits to "no" — the very next read excludes it, no delay.
    await putBoundary(put(ca, { itemId: 'x', answer: 'no' }), undefined as never);
    body = (await (await getPool(get('/api/boundaries/pool', ca), undefined as never)).json()) as {
      pool: string[];
    };
    expect(body.pool).toEqual([]);
  });

  it('a single "no" excludes at every mode via the endpoint (invariant #4)', async () => {
    const [a, b] = [await verifiedUser(), await verifiedUser()];
    const [ca, cb] = [await cookieFor(a), await cookieFor(b)];
    await pairActive(a, b);
    await putBoundary(put(ca, { itemId: 'x', answer: 'no' }), undefined as never);
    await putBoundary(put(cb, { itemId: 'x', answer: 'yes' }), undefined as never);

    for (const mode of ['both-yes', 'yes-and-maybe', 'maybe-and-maybe']) {
      const res = await getPool(get(`/api/boundaries/pool?mode=${mode}`, ca), undefined as never);
      const body = (await res.json()) as { pool: string[] };
      expect(body.pool).toEqual([]);
    }
  });
});
