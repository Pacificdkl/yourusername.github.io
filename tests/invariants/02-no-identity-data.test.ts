/**
 * Non-negotiable #2 — No raw identity data, ever.
 *
 * The verification callback persists ONLY: age_verified (boolean), provider_ref
 * (string), verified_at (timestamp). No image, document number, DOB, or
 * biometric template touches storage or logs.
 *
 * We drive the real callback route with a payload stuffed full of identity-like
 * fields and prove that (a) the stored user gains only the three permitted
 * fields and carries no identity column, and (b) none of the identity values
 * appear in anything logged during the flow.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { store, __resetStore } from '@/db';
import { signSession, SESSION_COOKIE_NAME } from '@/auth';
import { StubVerificationProvider } from '@/verify';
import { POST as verifyCallback } from '../../app/api/verify/callback/route';

const ALLOWED_USER_KEYS = [
  'id',
  'createdAt',
  'ageVerified',
  'providerRef',
  'verifiedAt',
  'deviceFpHash',
  'pinHash',
].sort();

// Values a hostile/naive provider payload might try to smuggle in.
const IDENTITY = {
  dob: '1990-01-02',
  documentNumber: 'X1234567',
  faceImage: 'data:image/png;base64,AAAA',
  biometricTemplate: 'BIO-TEMPLATE-DEADBEEF',
  fullName: 'Ada Lovelace',
};

describe('invariant #2: no raw identity data', () => {
  beforeEach(() => __resetStore());
  afterEach(() => vi.restoreAllMocks());

  it('VerificationResult carries only the three permitted fields', async () => {
    const result = await new StubVerificationProvider().handleCallback();
    expect(Object.keys(result).sort()).toEqual(['ageVerified', 'providerRef', 'verifiedAt'].sort());
    expect(typeof result.ageVerified).toBe('boolean');
    expect(typeof result.providerRef).toBe('string');
    expect(result.verifiedAt).toBeInstanceOf(Date);
  });

  it('callback persists only boolean + provider ref + timestamp; no identity columns', async () => {
    const user = await store.createUser();
    const cookie = `${SESSION_COOKIE_NAME}=${await signSession(user.id)}`;

    const res = await verifyCallback(
      new Request('http://localhost/api/verify/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'x-provider-signature': 'sig' },
        body: JSON.stringify(IDENTITY),
      }),
    );
    expect(res.status).toBe(200);

    const stored = await store.findUser(user.id);
    expect(stored).not.toBeNull();

    // The persisted shape has no identity field at all.
    expect(Object.keys(stored!).sort()).toEqual(ALLOWED_USER_KEYS);

    // Exactly the three verification fields were written.
    expect(stored!.ageVerified).toBe(true);
    expect(typeof stored!.providerRef).toBe('string');
    expect(stored!.verifiedAt).toBeInstanceOf(Date);

    // None of the identity values leaked into any stored field.
    const serialized = JSON.stringify(stored);
    for (const value of Object.values(IDENTITY)) {
      expect(serialized).not.toContain(value);
    }
  });

  it('no identity value appears in anything logged during verification', async () => {
    const captured: string[] = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        captured.push(args.map(String).join(' '));
      });
    }

    const user = await store.createUser();
    const cookie = `${SESSION_COOKIE_NAME}=${await signSession(user.id)}`;
    await verifyCallback(
      new Request('http://localhost/api/verify/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'x-provider-signature': 'sig' },
        body: JSON.stringify(IDENTITY),
      }),
    );

    const logs = captured.join('\n');
    for (const value of Object.values(IDENTITY)) {
      expect(logs).not.toContain(value);
    }
  });
});
