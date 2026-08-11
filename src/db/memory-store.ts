/**
 * In-memory UserStore. Used in dev and tests; NOT for production (no
 * persistence, no RLS). The production path is a PostgreSQL adapter over
 * migrations/0001_users.sql — see docs/decisions/0006-phase-1-auth-gate.md.
 *
 * Kept deliberately simple and synchronous-under-the-hood so the invariant
 * tests can seed state and read it back without a running database.
 */

import { randomInt } from '@/spin/rng';
import type {
  MagicToken,
  PendingChallenge,
  StoredCredential,
  User,
  UserStore,
  VerificationRecord,
} from './types';

function newId(): string {
  // Opaque, collision-resistant enough for tests/dev; the pg adapter uses
  // gen_random_uuid(). CSPRNG only (invariant #6).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  void randomInt; // keep the CSPRNG import meaningful if newId is refactored
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class MemoryUserStore implements UserStore {
  private users = new Map<string, User>();
  private credentials = new Map<string, { userId: string; cred: StoredCredential }>();
  private challenges = new Map<string, PendingChallenge>();
  private magicTokens = new Map<string, MagicToken>();
  private emailIndex = new Map<string, string>();

  async createUser(): Promise<User> {
    const user: User = {
      id: newId(),
      createdAt: new Date(),
      ageVerified: false,
      providerRef: null,
      verifiedAt: null,
      deviceFpHash: null,
      pinHash: null,
    };
    this.users.set(user.id, user);
    return { ...user };
  }

  async findUser(id: string): Promise<User | null> {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }

  async markVerified(userId: string, record: VerificationRecord): Promise<void> {
    const u = this.users.get(userId);
    if (!u) throw new Error('markVerified: unknown user');
    // Invariant #2: only these three fields are ever written by verification.
    u.ageVerified = true;
    u.providerRef = record.providerRef;
    u.verifiedAt = record.verifiedAt;
  }

  async addCredential(userId: string, cred: StoredCredential): Promise<void> {
    this.credentials.set(cred.id, { userId, cred: { ...cred } });
  }

  async getCredentials(userId: string): Promise<StoredCredential[]> {
    return [...this.credentials.values()]
      .filter((e) => e.userId === userId)
      .map((e) => ({ ...e.cred }));
  }

  async findCredentialById(
    credentialId: string,
  ): Promise<{ userId: string; cred: StoredCredential } | null> {
    const e = this.credentials.get(credentialId);
    return e ? { userId: e.userId, cred: { ...e.cred } } : null;
  }

  async updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
    const e = this.credentials.get(credentialId);
    if (e) e.cred.counter = counter;
  }

  async putChallenge(c: PendingChallenge): Promise<void> {
    this.challenges.set(c.userId, { ...c });
  }

  async takeChallenge(userId: string): Promise<PendingChallenge | null> {
    const c = this.challenges.get(userId);
    if (!c) return null;
    this.challenges.delete(userId);
    if (c.expiresAt.getTime() < Date.now()) return null;
    return c;
  }

  async putMagicToken(t: MagicToken): Promise<void> {
    this.magicTokens.set(t.tokenHash, { ...t });
  }

  async consumeMagicToken(tokenHash: string, now: Date): Promise<MagicToken | null> {
    const t = this.magicTokens.get(tokenHash);
    if (!t) return null;
    if (t.consumedAt || t.expiresAt.getTime() < now.getTime()) return null;
    t.consumedAt = now;
    return { ...t };
  }

  async findUserIdByEmailHash(emailHash: string): Promise<string | null> {
    return this.emailIndex.get(emailHash) ?? null;
  }

  async linkEmailHash(emailHash: string, userId: string): Promise<void> {
    this.emailIndex.set(emailHash, userId);
  }

  /** Test-only helper: wipe all state between test cases. */
  __reset(): void {
    this.users.clear();
    this.credentials.clear();
    this.challenges.clear();
    this.magicTokens.clear();
    this.emailIndex.clear();
  }
}
