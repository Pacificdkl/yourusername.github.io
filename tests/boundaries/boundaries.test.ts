/**
 * Boundaries unit tests (CLAUDE.md §7.3): three-state answers, own-only reads
 * (RLS analogue), shared-pool computation over two partners, and the
 * requirement that a pool read needs an ACTIVE pairing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import { setAnswer, getMyAnswers, computeSharedPoolIds, getPoolForUser } from '@/boundaries';
import { createInvite, redeemInvite, confirmPairing } from '@/pairing';

async function newUser(): Promise<string> {
  return (await store.createUser()).id;
}

async function pairActive(a: string, b: string): Promise<void> {
  const inv = await createInvite(a);
  if (!inv.ok) throw new Error(inv.reason);
  const red = await redeemInvite(inv.code, b);
  if (!red.ok) throw new Error(red.reason);
  const conf = await confirmPairing(red.pairingId, a);
  if (!conf.ok) throw new Error(conf.reason);
}

describe('boundary answers', () => {
  beforeEach(() => __resetStore());

  it('stores and edits a three-state answer (instant overwrite)', async () => {
    const u = await newUser();
    await setAnswer(u, 'item-1', 'yes');
    expect(await getMyAnswers(u)).toEqual([{ itemId: 'item-1', answer: 'yes' }]);

    await setAnswer(u, 'item-1', 'no'); // edit
    expect(await getMyAnswers(u)).toEqual([{ itemId: 'item-1', answer: 'no' }]);
  });

  it('returns only the caller\'s own answers (RLS analogue, invariant #5)', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await setAnswer(a, 'shared', 'yes');
    await setAnswer(b, 'shared', 'no');
    await setAnswer(b, 'only-b', 'yes');

    const aAnswers = await getMyAnswers(a);
    expect(aAnswers).toEqual([{ itemId: 'shared', answer: 'yes' }]);
    // A can never see B's item or answer through its own read.
    expect(JSON.stringify(aAnswers)).not.toContain('only-b');
  });
});

describe('shared pool computation', () => {
  it('both-yes: only items both said yes', () => {
    const a = [
      { itemId: 'x', answer: 'yes' as const },
      { itemId: 'y', answer: 'yes' as const },
      { itemId: 'z', answer: 'maybe' as const },
    ];
    const b = [
      { itemId: 'x', answer: 'yes' as const },
      { itemId: 'y', answer: 'maybe' as const },
      { itemId: 'z', answer: 'yes' as const },
    ];
    expect(computeSharedPoolIds(a, b, 'both-yes')).toEqual(['x']);
  });

  it('a single "no" excludes at every mode (invariant #4)', () => {
    const a = [{ itemId: 'x', answer: 'no' as const }];
    const b = [{ itemId: 'x', answer: 'yes' as const }];
    for (const mode of ['both-yes', 'yes-and-maybe', 'maybe-and-maybe'] as const) {
      expect(computeSharedPoolIds(a, b, mode)).toEqual([]);
    }
  });

  it('an unanswered item (one side missing) is never in the pool', () => {
    const a = [{ itemId: 'x', answer: 'yes' as const }];
    const b: { itemId: string; answer: 'yes' | 'maybe' | 'no' }[] = [];
    expect(computeSharedPoolIds(a, b, 'both-yes')).toEqual([]);
    expect(computeSharedPoolIds(a, b, 'yes-and-maybe')).toEqual([]);
  });

  it('widening includes maybe+maybe', () => {
    const a = [{ itemId: 'x', answer: 'maybe' as const }];
    const b = [{ itemId: 'x', answer: 'maybe' as const }];
    expect(computeSharedPoolIds(a, b, 'both-yes')).toEqual([]);
    expect(computeSharedPoolIds(a, b, 'maybe-and-maybe')).toEqual(['x']);
  });
});

describe('getPoolForUser', () => {
  beforeEach(() => __resetStore());

  it('requires an active pairing', async () => {
    const a = await newUser();
    const notPaired = await getPoolForUser(a);
    expect(notPaired.ok).toBe(false);
  });

  it('is empty while the pairing is only pending', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const inv = await createInvite(a);
    if (!inv.ok) throw new Error('invite');
    const red = await redeemInvite(inv.code, b); // pending, not confirmed
    if (!red.ok) throw new Error('redeem');
    const res = await getPoolForUser(a);
    expect(res.ok).toBe(false); // not active yet
  });

  it('computes the pool for an active pairing', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    await setAnswer(a, 'x', 'yes');
    await setAnswer(b, 'x', 'yes');
    await setAnswer(a, 'y', 'yes');
    await setAnswer(b, 'y', 'no');

    const res = await getPoolForUser(a);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.pool).toEqual(['x']);
  });
});
