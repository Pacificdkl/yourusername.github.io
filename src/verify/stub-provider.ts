/**
 * Stub age-assurance provider for local dev and tests. Approves deterministically
 * WITHOUT touching any real identity data — mirroring the invariant #2 contract
 * that the real adapters must also honour.
 *
 * Never enable in production: guarded by VERIFY_PROVIDER !== 'stub' at the
 * composition root (see src/verify/index.ts TODO).
 */

import { randomInt } from '@/spin/rng';
import type {
  VerificationProvider,
  VerificationResult,
  VerificationSession,
} from './provider';

export class StubVerificationProvider implements VerificationProvider {
  readonly id = 'stub';

  async start(userId: string): Promise<VerificationSession> {
    // Opaque, non-identifying handle. userId is not embedded in the ref.
    void userId;
    const sessionRef = `stub_${randomInt(0x7fffffff).toString(16)}`;
    return {
      sessionRef,
      redirectUrl: `/verify/stub?session=${sessionRef}`,
    };
  }

  async handleCallback(): Promise<VerificationResult> {
    // Deterministic approval. Returns ONLY the three permitted fields.
    return {
      ageVerified: true,
      providerRef: `stub_ref_${randomInt(0x7fffffff).toString(16)}`,
      verifiedAt: new Date(),
    };
  }
}
