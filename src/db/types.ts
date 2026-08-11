/**
 * Storage layer contracts.
 *
 * The app depends on these interfaces, not on a concrete database, so request
 * handlers and tests share one seam. Phase 1 ships an in-memory implementation
 * (src/db/memory-store.ts). A PostgreSQL adapter implementing the same
 * interface is the production path — the migration + RLS already exist
 * (migrations/0001_users.sql); wiring `pg` is deferred and tracked in
 * docs/decisions/0006-phase-1-auth-gate.md.
 *
 * Non-negotiable #2: the User shape carries ONLY the three permitted
 * verification fields plus hashes. There is deliberately no column for an
 * image, document number, DOB, or biometric template.
 */

/** A stored passkey (WebAuthn) credential. */
export interface StoredCredential {
  /** Base64URL credential id. */
  id: string;
  /** COSE public key bytes. */
  publicKey: Uint8Array;
  /** Signature counter, updated on each authentication (replay defence). */
  counter: number;
  transports?: string[];
}

/** The persisted user. Mirrors the `users` table (CLAUDE.md §5). */
export interface User {
  id: string;
  createdAt: Date;
  ageVerified: boolean;
  /** Opaque provider reference. Never identity data (invariant #2). */
  providerRef: string | null;
  verifiedAt: Date | null;
  /** Hash only — never a raw device fingerprint. */
  deviceFpHash: string | null;
  /** Hash only — never a raw PIN. */
  pinHash: string | null;
}

/** The minimal, permitted result of a verification callback (invariant #2). */
export interface VerificationRecord {
  providerRef: string;
  verifiedAt: Date;
}

/** A pending WebAuthn challenge, kept server-side between option issuance and verify. */
export interface PendingChallenge {
  userId: string;
  challenge: string;
  expiresAt: Date;
}

/** A hashed, single-use magic-link token. */
export interface MagicToken {
  /** SHA-256 hash of the raw token — the raw token is never stored. */
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface UserStore {
  createUser(): Promise<User>;
  findUser(id: string): Promise<User | null>;
  /** Persists ONLY age_verified=true, provider_ref, verified_at (invariant #2). */
  markVerified(userId: string, record: VerificationRecord): Promise<void>;

  // Passkeys
  addCredential(userId: string, cred: StoredCredential): Promise<void>;
  getCredentials(userId: string): Promise<StoredCredential[]>;
  findCredentialById(credentialId: string): Promise<{ userId: string; cred: StoredCredential } | null>;
  updateCredentialCounter(credentialId: string, counter: number): Promise<void>;

  // WebAuthn challenges (short-lived, server-side)
  putChallenge(c: PendingChallenge): Promise<void>;
  takeChallenge(userId: string): Promise<PendingChallenge | null>;

  // Magic-link fallback
  putMagicToken(t: MagicToken): Promise<void>;
  consumeMagicToken(tokenHash: string, now: Date): Promise<MagicToken | null>;

  /**
   * Email index for the magic-link fallback. We store a HASH of the email so a
   * login destination can be resolved to a user without persisting the address
   * in the users table (CLAUDE.md §5 keeps that table identity-free).
   */
  findUserIdByEmailHash(emailHash: string): Promise<string | null>;
  linkEmailHash(emailHash: string, userId: string): Promise<void>;
}
