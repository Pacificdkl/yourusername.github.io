/**
 * Auth unit tests for the parts that run without a real authenticator or DB:
 * session cookie round-trip, magic-link single-use semantics, and passkey
 * option generation. Full WebAuthn assertion verification needs a browser
 * authenticator and is exercised in integration, not here.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import {
  signSession,
  verifySession,
  getSession,
  SESSION_COOKIE_NAME,
} from '@/auth';
import { issueMagicLink, consumeMagicLink, emailHash } from '@/auth';
import { startRegistration, startAuthentication } from '@/auth';

describe('session cookies', () => {
  it('round-trips a valid session', async () => {
    const token = await signSession('user-123');
    const payload = await verifySession(token);
    expect(payload?.userId).toBe('user-123');
  });

  it('rejects a tampered token', async () => {
    const token = await signSession('user-123');
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(await verifySession(tampered)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signSession('user-123', -1000);
    expect(await verifySession(token)).toBeNull();
  });

  it('reads the session from a request Cookie header', async () => {
    const token = await signSession('user-abc');
    const req = new Request('http://localhost/', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect((await getSession(req))?.userId).toBe('user-abc');
  });
});

describe('magic-link fallback', () => {
  beforeEach(() => __resetStore());

  it('creates a user on first request and reuses it on the second', async () => {
    const a = await issueMagicLink('Person@Example.com');
    const b = await issueMagicLink('person@example.com'); // normalised to same hash
    expect(a.userId).toBe(b.userId);
    expect(await store.findUserIdByEmailHash(await emailHash('person@example.com'))).toBe(a.userId);
  });

  it('consumes a token exactly once (single-use)', async () => {
    const { token, userId } = await issueMagicLink('one@example.com');
    expect(await consumeMagicLink(token)).toBe(userId);
    expect(await consumeMagicLink(token)).toBeNull(); // replay rejected
  });

  it('rejects an unknown token', async () => {
    expect(await consumeMagicLink('not-a-real-token')).toBeNull();
  });
});

describe('passkey options', () => {
  beforeEach(() => __resetStore());

  it('registration options include a challenge and stash it server-side', async () => {
    const user = await store.createUser();
    const options = await startRegistration(user.id);
    expect(typeof options.challenge).toBe('string');
    expect(options.challenge.length).toBeGreaterThan(0);
    // The challenge is stored for later verification.
    const pending = await store.takeChallenge(user.id);
    expect(pending?.challenge).toBe(options.challenge);
  });

  it('authentication options include a challenge', async () => {
    const user = await store.createUser();
    const options = await startAuthentication(user.id);
    expect(typeof options.challenge).toBe('string');
  });
});
