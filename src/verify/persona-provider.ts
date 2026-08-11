/**
 * Real age-assurance adapter (Persona) — SCAFFOLD STUB.
 *
 * This is the shape of a real provider adapter; the network calls and
 * signature verification are intentionally left as TODOs for Phase 1
 * implementation. What matters for the scaffold is the invariant #2 boundary:
 * `handleCallback` reduces the provider payload to exactly three fields and
 * MUST NOT read, return, or log document images, numbers, DOB, or biometrics.
 *
 * See docs/decisions/0004-age-assurance.md for provider selection.
 */

import type {
  VerificationProvider,
  VerificationResult,
  VerificationSession,
} from './provider';

export class PersonaVerificationProvider implements VerificationProvider {
  readonly id = 'persona';

  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string,
  ) {}

  async start(_userId: string): Promise<VerificationSession> {
    // TODO(phase-1): create an inquiry via Persona's API and return its handoff.
    throw new Error('PersonaVerificationProvider.start not implemented');
  }

  async handleCallback(
    _rawBody: unknown,
    _signature: string | null,
  ): Promise<VerificationResult> {
    // TODO(phase-1):
    //   1. Verify HMAC signature with this.webhookSecret; reject on mismatch.
    //   2. Confirm the inquiry status is "completed" / "approved".
    //   3. Extract ONLY the inquiry id (as providerRef) and completion time.
    //      Do NOT read the verified attributes, images, or document fields.
    void this.apiKey;
    void this.webhookSecret;
    throw new Error('PersonaVerificationProvider.handleCallback not implemented');
  }
}
