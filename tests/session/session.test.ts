/**
 * Spin session tests (CLAUDE.md §7.5). The pure draw + uniformity chi-square
 * live in tests/invariants/06-csprng.test.ts. These cover the session flow that
 * drives it: filter-before-draw (#3), no-repeat as pool removal, the intensity
 * cap, and that unreviewed / non-consented items are never drawn.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import { setAnswer } from '@/boundaries';
import { createInvite, redeemInvite, confirmPairing } from '@/pairing';
import { insertItem, reviewItem } from '@/content';
import {
  startSession,
  updateSessionConfig,
  spin,
  endSession,
  getActiveSessionView,
} from '@/session';

const base = {
  category: 'position' as const,
  description: 'A plain description.',
  difficulty: 1,
  tags: [] as string[],
  safetyNotes: '',
  source: "Burton's 1883 Kama Sutra",
  licence: 'Public domain',
};

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

/** Insert a reviewed item and make both partners say `yes` to it. */
async function reviewedYes(
  a: string,
  b: string,
  title: string,
  intensity: number,
): Promise<string> {
  const item = await insertItem({ ...base, title, intensity });
  await reviewItem(item.id, 'reviewer');
  await setAnswer(a, item.id, 'yes');
  await setAnswer(b, item.id, 'yes');
  return item.id;
}

describe('session lifecycle', () => {
  beforeEach(() => __resetStore());

  it('startSession requires an active pairing', async () => {
    const a = await newUser();
    const res = await startSession(a);
    expect(res.ok).toBe(false);
  });

  it('startSession is idempotent while a session is active', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    const first = await startSession(a);
    const second = await startSession(a);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.session.sessionId).toBe(second.session.sessionId);
  });

  it('spin without a session returns no_session', async () => {
    const a = await newUser();
    const res = await spin(a);
    expect(res.ok).toBe(false);
  });
});

describe('draw: filter before draw (#3)', () => {
  beforeEach(() => __resetStore());

  it('only ever returns items in the drawable pool', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    const ids = new Set([
      await reviewedYes(a, b, 'one', 1),
      await reviewedYes(a, b, 'two', 1),
      await reviewedYes(a, b, 'three', 1),
    ]);
    // An unreviewed item both said yes to — must never be drawn.
    const unreviewed = await insertItem({ ...base, title: 'unreviewed', intensity: 1 });
    await setAnswer(a, unreviewed.id, 'yes');
    await setAnswer(b, unreviewed.id, 'yes');
    // An item one said no to — must never be drawn.
    const noItem = await insertItem({ ...base, title: 'no-item', intensity: 1 });
    await reviewItem(noItem.id, 'reviewer');
    await setAnswer(a, noItem.id, 'yes');
    await setAnswer(b, noItem.id, 'no');

    await startSession(a, { noRepeat: false });
    for (let i = 0; i < 200; i++) {
      const res = await spin(a);
      expect(res.ok).toBe(true);
      if (res.ok && res.item) {
        expect(ids.has(res.item.id)).toBe(true);
        expect(res.item.id).not.toBe(unreviewed.id);
        expect(res.item.id).not.toBe(noItem.id);
      }
    }
  });

  it('respects the intensity cap', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    const low = await reviewedYes(a, b, 'low', 2);
    const high = await reviewedYes(a, b, 'high', 5);

    await startSession(a, { intensityCap: 2, noRepeat: false });
    for (let i = 0; i < 100; i++) {
      const res = await spin(a);
      if (res.ok && res.item) {
        expect(res.item.id).toBe(low);
        expect(res.item.id).not.toBe(high);
      }
    }
  });
});

describe('no-repeat as pool removal (§7.5)', () => {
  beforeEach(() => __resetStore());

  it('draws each item once, then exhausts the pool', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    const ids = new Set([
      await reviewedYes(a, b, 'one', 1),
      await reviewedYes(a, b, 'two', 1),
      await reviewedYes(a, b, 'three', 1),
    ]);

    await startSession(a, { noRepeat: true });
    const drawn = new Set<string>();
    for (let i = 0; i < ids.size; i++) {
      const res = await spin(a);
      expect(res.ok).toBe(true);
      if (res.ok && res.item) drawn.add(res.item.id);
    }
    expect(drawn).toEqual(ids); // all distinct, whole set covered

    // Pool now exhausted.
    const last = await spin(a);
    expect(last.ok).toBe(true);
    if (last.ok) expect(last.item).toBeNull();
  });

  it('with noRepeat false, a single item can repeat', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    const only = await reviewedYes(a, b, 'only', 1);
    await startSession(a, { noRepeat: false });
    const r1 = await spin(a);
    const r2 = await spin(a);
    expect(r1.ok && r1.item?.id).toBe(only);
    expect(r2.ok && r2.item?.id).toBe(only);
  });
});

describe('category filter + live config (§7.6)', () => {
  beforeEach(() => __resetStore());

  it('only draws items in the selected categories', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    const position = await reviewedYes(a, b, 'pos', 1); // category 'position'
    // A massage item both consented to.
    const massage = await insertItem({ ...base, title: 'mass', category: 'massage', intensity: 1 });
    await reviewItem(massage.id, 'reviewer');
    await setAnswer(a, massage.id, 'yes');
    await setAnswer(b, massage.id, 'yes');

    await startSession(a, { noRepeat: false, categories: ['position'] });
    for (let i = 0; i < 100; i++) {
      const res = await spin(a);
      if (res.ok && res.item) {
        expect(res.item.id).toBe(position);
        expect(res.item.id).not.toBe(massage.id);
      }
    }
  });

  it('lowering the intensity cap mid-session takes effect on the next spin', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    const low = await reviewedYes(a, b, 'low', 1);
    const high = await reviewedYes(a, b, 'high', 5);

    await startSession(a, { intensityCap: 5, noRepeat: false });
    // Cap 5: both eligible.
    const wide = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = await spin(a);
      if (r.ok && r.item) wide.add(r.item.id);
    }
    expect(wide.has(low) || wide.has(high)).toBe(true);

    // Lower the cap live.
    const updated = await updateSessionConfig(a, { intensityCap: 1 });
    expect(updated.ok && updated.session.intensityCap).toBe(1);
    for (let i = 0; i < 60; i++) {
      const r = await spin(a);
      if (r.ok && r.item) expect(r.item.id).toBe(low); // high now filtered out
    }
  });
});

describe('draws recorded + end', () => {
  beforeEach(() => __resetStore());

  it('records each draw and reflects the count; end stops the session', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);
    await reviewedYes(a, b, 'one', 1);
    await reviewedYes(a, b, 'two', 1);

    const started = await startSession(a, { noRepeat: true });
    if (!started.ok) throw new Error('start');
    await spin(a);
    await spin(a);

    const view = await getActiveSessionView(a);
    expect(view?.drawCount).toBe(2);
    expect((await store.getDrawsForSession(started.session.sessionId)).length).toBe(2);

    await endSession(a);
    expect(await getActiveSessionView(a)).toBeNull();
    const afterEnd = await spin(a);
    expect(afterEnd.ok).toBe(false); // no active session
  });
});
