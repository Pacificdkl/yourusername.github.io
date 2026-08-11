/**
 * Non-negotiable #7 — Unilateral unpair.
 *
 * Instant, no approval, no delay, no notification to the other party beyond the
 * pairing simply being gone. Shared session history is deleted in the SAME
 * transaction.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import { createInvite, redeemInvite, confirmPairing, getPairingView, unpair } from '@/pairing';

async function newUser(): Promise<string> {
  return (await store.createUser()).id;
}

async function pairUp(a: string, b: string): Promise<string> {
  const invite = await createInvite(a);
  if (!invite.ok) throw new Error(invite.reason);
  const redeemed = await redeemInvite(invite.code, b);
  if (!redeemed.ok) throw new Error(redeemed.reason);
  const confirmed = await confirmPairing(redeemed.pairingId, a);
  if (!confirmed.ok) throw new Error(confirmed.reason);
  return redeemed.pairingId;
}

describe('invariant #7: unilateral unpair', () => {
  beforeEach(() => __resetStore());

  it('either partner can unpair without the other\'s approval', async () => {
    const [a, b] = [await newUser(), await newUser()];

    // The redeemer (B) unpairs — A never approved.
    await pairUp(a, b);
    expect((await unpair(b)).unpaired).toBe(true);
    expect(await getPairingView(a)).toBeNull();
    expect(await getPairingView(b)).toBeNull();

    // Re-pair; this time the issuer (A) unpairs — B never approved.
    await pairUp(a, b);
    expect((await unpair(a)).unpaired).toBe(true);
    expect(await getPairingView(a)).toBeNull();
    expect(await getPairingView(b)).toBeNull();
  });

  it('takes effect immediately — no delay or grace window', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairUp(a, b);
    // A single awaited call is the whole operation; the pairing is gone right after.
    await unpair(a);
    expect(await getPairingView(a)).toBeNull();
    expect(await getPairingView(b)).toBeNull();
  });

  it('deletes sessions + session_draws for the pairing in the same transaction', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const pairingId = await pairUp(a, b);

    await store.addSession({
      id: 'sess-1',
      pairingId,
      intensityCap: 3,
      noRepeat: true,
      startedAt: new Date(),
      endedAt: null,
    });
    await store.addSessionDraw({ sessionId: 'sess-1', itemId: 'item-1', drawnAt: new Date() });
    await store.addSessionDraw({ sessionId: 'sess-1', itemId: 'item-2', drawnAt: new Date() });

    expect((await store.getSessionsForPairing(pairingId)).length).toBe(1);
    expect((await store.getDrawsForSession('sess-1')).length).toBe(2);

    await unpair(b);

    // Same-transaction cascade: pairing, its sessions, and their draws are all gone.
    expect(await getPairingView(a)).toBeNull();
    expect((await store.getSessionsForPairing(pairingId)).length).toBe(0);
    expect((await store.getDrawsForSession('sess-1')).length).toBe(0);
  });

  it('the other party is not consulted and gets no notification — only absence', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairUp(a, b);

    // B unpairs. A took no part; the operation's only effect is deletion — its
    // result reports removed ids, never a notification recipient.
    const result = await unpair(b);
    expect(result.unpaired).toBe(true);
    expect(Object.keys(result)).not.toContain('notified');
    expect(Object.keys(result)).not.toContain('notification');

    // A discovers the change solely by the pairing being gone.
    expect(await getPairingView(a)).toBeNull();
  });

  it('unpairing when not paired is a no-op', async () => {
    const a = await newUser();
    expect((await unpair(a)).unpaired).toBe(false);
  });
});
