/**
 * Age-assurance provider adapter: one interface, multiple impls (CLAUDE.md §4).
 * Third-party only — Yoti, Persona, Veriff, or Stripe Identity (CLAUDE.md §3).
 * Offer at least two check methods in production.
 *
 * Non-negotiable #2: no raw identity data ever. The ONLY thing a provider
 * returns to us is the verified boolean, an opaque provider reference, and a
 * timestamp. No image, document number, DOB, or biometric template crosses
 * this boundary. `VerificationResult` has no field that could hold one — the
 * type is the enforcement.
 */

/** The complete, minimal result we are allowed to persist (invariant #2). */
export interface VerificationResult {
  ageVerified: boolean;
  /** Opaque reference at the provider. Not a document id, not identity data. */
  providerRef: string;
  verifiedAt: Date;
}

/** A verification flow the user can start. */
export interface VerificationSession {
  /** Opaque handle to resume/poll the flow. */
  sessionRef: string;
  /** Where to send the user to complete the check. */
  redirectUrl: string;
}

export interface VerificationProvider {
  readonly id: string;

  /** Begin a check for the given app user; returns a redirect handoff. */
  start(userId: string): Promise<VerificationSession>;

  /**
   * Validate an inbound provider webhook/callback and reduce it to the minimal
   * result. Implementations MUST NOT return, log, or retain any identity data.
   */
  handleCallback(rawBody: unknown, signature: string | null): Promise<VerificationResult>;
}
