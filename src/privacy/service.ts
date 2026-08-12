/**
 * Privacy service (CLAUDE.md §7.7): PIN lock, data export, true delete.
 *
 * Export (invariants #2, #5): returns ONLY the caller's own data — the three
 * permitted verification fields (no identity data), the caller's own boundary
 * answers (never the partner's), the caller's pairing summary, and the caller's
 * session history. There is no path here to a partner's answers.
 */

import { store } from '@/db';
import type { BoundaryAnswerRow } from '@/db';
import { getPairingView } from '@/pairing';
import { hashPin, verifyPinHash } from './pin';

// --- PIN lock ---

export async function setPin(userId: string, pin: string): Promise<void> {
  await store.setPinHash(userId, await hashPin(pin));
}

export async function hasPin(userId: string): Promise<boolean> {
  const user = await store.findUser(userId);
  return Boolean(user?.pinHash);
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const user = await store.findUser(userId);
  if (!user?.pinHash) return false;
  return verifyPinHash(user.pinHash, pin);
}

// --- Export ---

export interface UserExport {
  exportedAt: string;
  account: {
    id: string;
    createdAt: Date;
    ageVerified: boolean;
    providerRef: string | null;
    verifiedAt: Date | null;
  };
  pairing: { partnerId: string; status: string } | null;
  boundaries: BoundaryAnswerRow[];
  sessionHistory: {
    sessionId: string;
    startedAt: Date;
    endedAt: Date | null;
    draws: { itemId: string; drawnAt: Date }[];
  }[];
}

export async function exportData(userId: string): Promise<UserExport> {
  const user = await store.findUser(userId);
  if (!user) throw new Error('exportData: unknown user');

  const pairingView = await getPairingView(userId);

  let sessionHistory: UserExport['sessionHistory'] = [];
  if (pairingView) {
    const sessions = await store.getSessionsForPairing(pairingView.pairingId);
    sessionHistory = await Promise.all(
      sessions.map(async (s) => ({
        sessionId: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        draws: (await store.getDrawsForSession(s.id)).map((d) => ({
          itemId: d.itemId,
          drawnAt: d.drawnAt,
        })),
      })),
    );
  }

  return {
    exportedAt: new Date().toISOString(),
    // Only the permitted verification fields — no identity data (#2).
    account: {
      id: user.id,
      createdAt: user.createdAt,
      ageVerified: user.ageVerified,
      providerRef: user.providerRef,
      verifiedAt: user.verifiedAt,
    },
    pairing: pairingView ? { partnerId: pairingView.partnerId, status: pairingView.status } : null,
    // The caller's OWN answers only (#5).
    boundaries: await store.getBoundaryAnswers(userId),
    sessionHistory,
  };
}

// --- True delete ---

export async function deleteAccount(userId: string): Promise<void> {
  await store.deleteUser(userId);
}
