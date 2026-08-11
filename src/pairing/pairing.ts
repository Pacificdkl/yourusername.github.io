/**
 * Pairing lifecycle (CLAUDE.md §7.2):
 *  - createInvite  — issuer generates a single-use code (one pairing per user).
 *  - redeemInvite  — redeemer consumes the code → a PENDING pairing (their half
 *    of the dual confirmation).
 *  - confirmPairing — the issuer confirms → ACTIVE. Both sides must confirm.
 *  - unpair        — unilateral, instant, cascade delete (non-negotiable #7).
 *
 * Failure reasons are coarse and non-disclosive (invariant #5 spirit): callers
 * cannot tell "already paired" apart from "self pair" beyond what they need.
 */

import { store } from '@/db';
import { generateUniqueCode, INVITE_TTL_MS } from './invite';

export type CreateInviteResult =
  | { ok: true; code: string; expiresAt: Date }
  | { ok: false; reason: 'already_paired' };

export type RedeemResult =
  | { ok: true; pairingId: string; status: 'pending' | 'active' }
  | { ok: false; reason: 'invalid_code' | 'self_pair' | 'already_paired' };

export type ConfirmResult =
  | { ok: true; status: 'pending' | 'active' }
  | { ok: false; reason: 'not_found' | 'not_a_member' | 'already_ended' };

export interface PairingView {
  pairingId: string;
  partnerId: string;
  status: 'pending' | 'active';
}

function newId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes); // invariant #6
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Issuer creates a single-use invite. Refused if the issuer is already paired. */
export async function createInvite(issuerUserId: string): Promise<CreateInviteResult> {
  if (await store.getPairingForUser(issuerUserId)) {
    return { ok: false, reason: 'already_paired' };
  }
  const code = await generateUniqueCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await store.createInvite({ code, issuer: issuerUserId, expiresAt, consumedAt: null });
  return { ok: true, code, expiresAt };
}

/**
 * Redeemer consumes a code, creating a PENDING pairing. The redeemer's action is
 * their confirmation; the issuer must still confirm to activate.
 */
export async function redeemInvite(code: string, redeemerUserId: string): Promise<RedeemResult> {
  const invite = await store.getInvite(code);
  if (!invite || invite.consumedAt || invite.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'invalid_code' };
  }
  if (invite.issuer === redeemerUserId) {
    return { ok: false, reason: 'self_pair' };
  }
  if (
    (await store.getPairingForUser(redeemerUserId)) ||
    (await store.getPairingForUser(invite.issuer))
  ) {
    return { ok: false, reason: 'already_paired' };
  }

  // Atomically claim the code (single use). A lost race reads back as invalid.
  const consumed = await store.consumeInvite(code, new Date());
  if (!consumed) return { ok: false, reason: 'invalid_code' };

  const pairingId = newId();
  await store.createPairing({
    id: pairingId,
    userA: invite.issuer,
    userB: redeemerUserId,
    status: 'pending',
    createdAt: new Date(),
    confirmedA: false,
    confirmedB: true, // redeeming is the redeemer's confirmation
  });
  return { ok: true, pairingId, status: 'pending' };
}

/** A member confirms a pending pairing; when both have, it goes active. */
export async function confirmPairing(pairingId: string, userId: string): Promise<ConfirmResult> {
  const pairing = await store.getPairing(pairingId);
  if (!pairing) return { ok: false, reason: 'not_found' };
  if (userId !== pairing.userA && userId !== pairing.userB) {
    return { ok: false, reason: 'not_a_member' };
  }
  if (pairing.status === 'ended') return { ok: false, reason: 'already_ended' };

  if (userId === pairing.userA) pairing.confirmedA = true;
  if (userId === pairing.userB) pairing.confirmedB = true;
  if (pairing.confirmedA && pairing.confirmedB) pairing.status = 'active';
  await store.updatePairing(pairing);

  return { ok: true, status: pairing.status === 'active' ? 'active' : 'pending' };
}

/** The caller's current pairing, partner id, and status — or null. Opacity-safe. */
export async function getPairingView(userId: string): Promise<PairingView | null> {
  const p = await store.getPairingForUser(userId);
  if (!p || p.status === 'ended') return null;
  const partnerId = p.userA === userId ? p.userB : p.userA;
  return { pairingId: p.id, partnerId, status: p.status };
}

/**
 * Unilateral unpair (non-negotiable #7): instant, no approval, no delay, no
 * notification. Shared session history is deleted in the same transaction (the
 * store method is the transaction).
 */
export async function unpair(userId: string): Promise<{ unpaired: boolean }> {
  const result = await store.unpairUser(userId);
  return { unpaired: result.pairingId !== null };
}
