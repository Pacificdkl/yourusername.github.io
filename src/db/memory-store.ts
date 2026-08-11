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
  InviteCode,
  MagicToken,
  Pairing,
  PairingStore,
  PendingChallenge,
  SessionDrawRow,
  SessionRow,
  StoredCredential,
  UnpairResult,
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

export class MemoryUserStore implements UserStore, PairingStore {
  private users = new Map<string, User>();
  private credentials = new Map<string, { userId: string; cred: StoredCredential }>();
  private challenges = new Map<string, PendingChallenge>();
  private magicTokens = new Map<string, MagicToken>();
  private emailIndex = new Map<string, string>();
  private invites = new Map<string, InviteCode>();
  private pairings = new Map<string, Pairing>();
  private sessions = new Map<string, SessionRow>();
  private draws: SessionDrawRow[] = [];

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

  // --- PairingStore ---

  async createInvite(invite: InviteCode): Promise<void> {
    this.invites.set(invite.code, { ...invite });
  }

  async getInvite(code: string): Promise<InviteCode | null> {
    const i = this.invites.get(code);
    return i ? { ...i } : null;
  }

  async consumeInvite(code: string, now: Date): Promise<InviteCode | null> {
    const i = this.invites.get(code);
    if (!i) return null;
    if (i.consumedAt || i.expiresAt.getTime() < now.getTime()) return null;
    i.consumedAt = now; // single-use, atomic in this single-threaded store
    return { ...i };
  }

  async createPairing(pairing: Pairing): Promise<void> {
    this.pairings.set(pairing.id, { ...pairing });
  }

  async getPairing(id: string): Promise<Pairing | null> {
    const p = this.pairings.get(id);
    return p ? { ...p } : null;
  }

  async getPairingForUser(userId: string): Promise<Pairing | null> {
    for (const p of this.pairings.values()) {
      if (p.status !== 'ended' && (p.userA === userId || p.userB === userId)) {
        return { ...p };
      }
    }
    return null;
  }

  async updatePairing(pairing: Pairing): Promise<void> {
    this.pairings.set(pairing.id, { ...pairing });
  }

  async addSession(session: SessionRow): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async addSessionDraw(draw: SessionDrawRow): Promise<void> {
    this.draws.push({ ...draw });
  }

  async getSessionsForPairing(pairingId: string): Promise<SessionRow[]> {
    return [...this.sessions.values()].filter((s) => s.pairingId === pairingId).map((s) => ({ ...s }));
  }

  async getDrawsForSession(sessionId: string): Promise<SessionDrawRow[]> {
    return this.draws.filter((d) => d.sessionId === sessionId).map((d) => ({ ...d }));
  }

  async unpairUser(userId: string): Promise<UnpairResult> {
    // Single synchronous critical section = one transaction (invariant #7).
    let target: Pairing | null = null;
    for (const p of this.pairings.values()) {
      if (p.status !== 'ended' && (p.userA === userId || p.userB === userId)) {
        target = p;
        break;
      }
    }
    if (!target) return { pairingId: null, deletedSessionIds: [] };

    const sessionIds = [...this.sessions.values()]
      .filter((s) => s.pairingId === target!.id)
      .map((s) => s.id);

    // Delete draws, then sessions, then the pairing itself — all together.
    this.draws = this.draws.filter((d) => !sessionIds.includes(d.sessionId));
    for (const sid of sessionIds) this.sessions.delete(sid);
    this.pairings.delete(target.id);

    return { pairingId: target.id, deletedSessionIds: sessionIds };
  }

  /** Test-only helper: wipe all state between test cases. */
  __reset(): void {
    this.users.clear();
    this.credentials.clear();
    this.challenges.clear();
    this.magicTokens.clear();
    this.emailIndex.clear();
    this.invites.clear();
    this.pairings.clear();
    this.sessions.clear();
    this.draws = [];
  }
}
