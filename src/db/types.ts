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

export type ContentCategory = 'position' | 'massage' | 'sensation' | 'bdsm' | 'roleplay';

/** A content library item (CLAUDE.md §5). */
export interface ContentItemRecord {
  id: string;
  title: string;
  category: ContentCategory;
  description: string;
  intensity: number; // 1..5
  difficulty: number; // 1..5
  tags: string[];
  /** Required non-empty for BDSM (DB constraint, §6). */
  safetyNotes: string;
  /** Provenance — required before an item can ship (§6). */
  source: string;
  licence: string;
  /** Review workflow — an item ships only once a human sets these (§6). */
  reviewedBy: string | null;
  reviewedAt: Date | null;
}

export interface ContentStore {
  /**
   * Insert an item. Enforces the DB-constraint analogues and THROWS on
   * violation (a failed insert, §6): source/licence/title/description non-empty,
   * BDSM requires non-empty safety_notes, intensity/difficulty in 1..5.
   */
  addContentItem(item: ContentItemRecord): Promise<void>;
  getContentItem(id: string): Promise<ContentItemRecord | null>;
  getAllContentItems(): Promise<ContentItemRecord[]>;
  /** Only reviewed items (reviewed_at IS NOT NULL) — the production guard (§6). */
  getShippableContentItems(): Promise<ContentItemRecord[]>;
  markContentReviewed(id: string, reviewedBy: string, reviewedAt: Date): Promise<void>;
}

export type BoundaryAnswer = 'yes' | 'maybe' | 'no';

/** One user's answer for one item. Readable only by that user (CLAUDE.md §5). */
export interface BoundaryAnswerRow {
  itemId: string;
  answer: BoundaryAnswer;
}

export interface BoundaryStore {
  /** Upsert — editing overwrites, taking effect immediately (§7.3). */
  setBoundaryAnswer(userId: string, itemId: string, answer: BoundaryAnswer): Promise<void>;
  getBoundaryAnswer(userId: string, itemId: string): Promise<BoundaryAnswer | null>;
  /** Returns ONLY this user's rows (the RLS `user_id = current_user` analogue). */
  getBoundaryAnswers(userId: string): Promise<BoundaryAnswerRow[]>;
}

export type PairingStatus = 'pending' | 'active' | 'ended';

/** One pairing between two users. At most one non-ended per user (CLAUDE.md §5). */
export interface Pairing {
  id: string;
  /** The invite issuer. */
  userA: string;
  /** The redeemer. */
  userB: string;
  status: PairingStatus;
  createdAt: Date;
  /** Dual confirmation: both sides must confirm before the pairing goes active. */
  confirmedA: boolean;
  confirmedB: boolean;
}

/** A single-use invite code: 6 chars, 15 min, single use (CLAUDE.md §5). */
export interface InviteCode {
  code: string;
  issuer: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

/** A play session (Phase 5/6). Present here so unpair can cascade-delete it. */
export interface SessionRow {
  id: string;
  pairingId: string;
  intensityCap: number;
  noRepeat: boolean;
  startedAt: Date;
  endedAt: Date | null;
}

/** A drawn item within a session. Deleted with its session (invariant #7). */
export interface SessionDrawRow {
  sessionId: string;
  itemId: string;
  drawnAt: Date;
}

/** Result of an atomic unpair (invariant #7). */
export interface UnpairResult {
  pairingId: string | null;
  deletedSessionIds: string[];
}

export interface PairingStore {
  // Invite codes
  createInvite(invite: InviteCode): Promise<void>;
  getInvite(code: string): Promise<InviteCode | null>;
  /** Atomically marks an unexpired, unconsumed invite consumed; else null. */
  consumeInvite(code: string, now: Date): Promise<InviteCode | null>;

  // Pairings
  createPairing(pairing: Pairing): Promise<void>;
  getPairing(id: string): Promise<Pairing | null>;
  /** The user's current non-ended pairing, if any (enforces one-per-user). */
  getPairingForUser(userId: string): Promise<Pairing | null>;
  updatePairing(pairing: Pairing): Promise<void>;

  // Sessions
  addSession(session: SessionRow): Promise<void>;
  getSession(id: string): Promise<SessionRow | null>;
  updateSession(session: SessionRow): Promise<void>;
  /** The pairing's current non-ended session, if any. */
  getActiveSessionForPairing(pairingId: string): Promise<SessionRow | null>;
  addSessionDraw(draw: SessionDrawRow): Promise<void>;
  getSessionsForPairing(pairingId: string): Promise<SessionRow[]>;
  getDrawsForSession(sessionId: string): Promise<SessionDrawRow[]>;

  /**
   * Unilateral unpair (invariant #7): in ONE transaction, delete the user's
   * pairing and every session + session_draw belonging to it. No approval, no
   * delay, no notification. Returns what was removed, or nulls if not paired.
   */
  unpairUser(userId: string): Promise<UnpairResult>;
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
