/**
 * Pairing unit tests (CLAUDE.md §7.2): invite generation (6 chars, 15 min,
 * single use), self-pair guard, expiry, one-active-pairing-per-user, and dual
 * confirmation (pending → active).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import {
  createInvite,
  redeemInvite,
  confirmPairing,
  getPairingView,
  INVITE_CODE_LENGTH,
  INVITE_ALPHABET,
  INVITE_TTL_MS,
} from '@/pairing';

async function newUser(): Promise<string> {
  return (await store.createUser()).id;
}

/** Drives a pair to active: issuer invites, redeemer redeems, issuer confirms. */
async function pairUp(a: string, b: string): Promise<string> {
  const invite = await createInvite(a);
  if (!invite.ok) throw new Error(`createInvite failed: ${invite.reason}`);
  const redeemed = await redeemInvite(invite.code, b);
  if (!redeemed.ok) throw new Error(`redeem failed: ${redeemed.reason}`);
  const confirmed = await confirmPairing(redeemed.pairingId, a);
  if (!confirmed.ok) throw new Error(`confirm failed: ${confirmed.reason}`);
  expect(confirmed.status).toBe('active');
  return redeemed.pairingId;
}

describe('invite codes', () => {
  beforeEach(() => __resetStore());

  it('are 6 chars from the unambiguous alphabet', async () => {
    const a = await newUser();
    const invite = await createInvite(a);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    expect(invite.code).toHaveLength(INVITE_CODE_LENGTH);
    expect(INVITE_CODE_LENGTH).toBe(6);
    for (const ch of invite.code) expect(INVITE_ALPHABET).toContain(ch);
  });

  it('expire 15 minutes out', async () => {
    const a = await newUser();
    const invite = await createInvite(a);
    if (!invite.ok) throw new Error('expected invite');
    expect(INVITE_TTL_MS).toBe(15 * 60 * 1000);
    const delta = invite.expiresAt.getTime() - Date.now();
    expect(delta).toBeGreaterThan(INVITE_TTL_MS - 5_000);
    expect(delta).toBeLessThanOrEqual(INVITE_TTL_MS + 1_000);
  });

  it('are single use', async () => {
    const [a, b, c] = [await newUser(), await newUser(), await newUser()];
    const invite = await createInvite(a);
    if (!invite.ok) throw new Error('expected invite');
    const first = await redeemInvite(invite.code, b);
    expect(first.ok).toBe(true);
    const second = await redeemInvite(invite.code, c);
    expect(second.ok).toBe(false);
  });

  it('reject an expired code', async () => {
    const [a, b] = [await newUser(), await newUser()];
    // Craft an already-expired invite directly in the store.
    await store.createInvite({
      code: 'EXPIRE',
      issuer: a,
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
    });
    const res = await redeemInvite('EXPIRE', b);
    expect(res.ok).toBe(false);
  });

  it('reject self-pairing', async () => {
    const a = await newUser();
    const invite = await createInvite(a);
    if (!invite.ok) throw new Error('expected invite');
    const res = await redeemInvite(invite.code, a);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('self_pair');
  });
});

describe('pairing lifecycle', () => {
  beforeEach(() => __resetStore());

  it('requires dual confirmation: redeem is pending until the issuer confirms', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const invite = await createInvite(a);
    if (!invite.ok) throw new Error('expected invite');
    const redeemed = await redeemInvite(invite.code, b);
    if (!redeemed.ok) throw new Error('expected redeem');
    expect(redeemed.status).toBe('pending');

    // Still pending before the issuer confirms.
    expect((await getPairingView(a))?.status).toBe('pending');
    expect((await getPairingView(b))?.status).toBe('pending');

    const confirmed = await confirmPairing(redeemed.pairingId, a);
    expect(confirmed.ok && confirmed.status).toBe('active');
    expect((await getPairingView(a))?.status).toBe('active');
    expect((await getPairingView(b))?.status).toBe('active');
  });

  it('exposes the partner id and status, but this endpoint carries no boundary data', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairUp(a, b);
    const viewA = await getPairingView(a);
    expect(viewA?.partnerId).toBe(b);
    expect(viewA?.status).toBe('active');
    // Opacity (#5): the pairing view has no per-item answer fields.
    expect(Object.keys(viewA!).sort()).toEqual(['pairingId', 'partnerId', 'status'].sort());
  });

  it('enforces one active pairing per user', async () => {
    const [a, b, c] = [await newUser(), await newUser(), await newUser()];
    await pairUp(a, b);

    // Already-paired issuer cannot create a new invite.
    const invite = await createInvite(a);
    expect(invite.ok).toBe(false);

    // Already-paired user cannot redeem someone else's invite.
    const cInvite = await createInvite(c);
    if (!cInvite.ok) throw new Error('expected invite');
    const res = await redeemInvite(cInvite.code, b);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('already_paired');
  });
});
