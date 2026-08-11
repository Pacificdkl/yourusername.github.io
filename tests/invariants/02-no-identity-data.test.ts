/**
 * Non-negotiable #2 — No raw identity data, ever.
 *
 * The verification callback persists ONLY: age_verified (boolean),
 * provider_ref (string), verified_at (timestamp). No image, document number,
 * DOB, or biometric template touches storage or logs.
 *
 * We can already assert the *type* boundary now: VerificationResult has
 * exactly three fields. Phase 1 adds the persistence + log-scrubbing tests.
 */
import { describe, it, expect } from 'vitest';
import { StubVerificationProvider } from '@/verify';

describe('invariant #2: no raw identity data', () => {
  it('VerificationResult carries only the three permitted fields', async () => {
    const provider = new StubVerificationProvider();
    const result = await provider.handleCallback();
    expect(Object.keys(result).sort()).toEqual(
      ['ageVerified', 'providerRef', 'verifiedAt'].sort(),
    );
    expect(typeof result.ageVerified).toBe('boolean');
    expect(typeof result.providerRef).toBe('string');
    expect(result.verifiedAt).toBeInstanceOf(Date);
  });

  it.todo('DB row after callback contains no image/document-number/DOB/biometric column');
  it.todo('no identity payload appears in any log line during verification');
});
