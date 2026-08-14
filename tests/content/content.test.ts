/**
 * Content tests (CLAUDE.md §6, §7.4): schema constraints (BDSM safety_notes,
 * required provenance, value ranges), the review workflow + production guard
 * (reviewed_at IS NULL never ships), and seed provenance (public-domain only,
 * fully attributed).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import {
  insertItem,
  reviewItem,
  getShippableItems,
  getShippableItemIds,
  getDrawablePoolForUser,
  seedContent,
  SEED,
} from '@/content';
import { setAnswer } from '@/boundaries';
import { createInvite, redeemInvite, confirmPairing } from '@/pairing';

const baseItem = {
  title: 'Test position',
  category: 'position' as const,
  description: 'A plain, non-graphic description.',
  intensity: 2,
  difficulty: 2,
  tags: ['gentle'],
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

describe('content schema constraints', () => {
  beforeEach(() => __resetStore());

  it('inserts and reads back a valid item', async () => {
    const item = await insertItem(baseItem);
    expect(item.id).toBeTruthy();
    const fetched = await store.getContentItem(item.id);
    expect(fetched?.title).toBe('Test position');
  });

  it('rejects a BDSM item with empty safety_notes (failed insert)', async () => {
    await expect(
      insertItem({ ...baseItem, category: 'bdsm', safetyNotes: '' }),
    ).rejects.toThrow();
  });

  it('rejects a BDSM item with whitespace-only safety_notes', async () => {
    await expect(
      insertItem({ ...baseItem, category: 'bdsm', safetyNotes: '   ' }),
    ).rejects.toThrow();
  });

  it('accepts a BDSM item that has real safety_notes', async () => {
    const item = await insertItem({
      ...baseItem,
      category: 'bdsm',
      safetyNotes:
        'Check circulation and nerve compression, plan aftercare, never leave a bound person alone. Resource: https://www.scarleteen.com/',
    });
    expect(item.category).toBe('bdsm');
  });

  it('rejects items missing source or licence', async () => {
    await expect(insertItem({ ...baseItem, source: '' })).rejects.toThrow();
    await expect(insertItem({ ...baseItem, licence: '' })).rejects.toThrow();
  });

  it('rejects out-of-range intensity/difficulty', async () => {
    await expect(insertItem({ ...baseItem, intensity: 0 })).rejects.toThrow();
    await expect(insertItem({ ...baseItem, difficulty: 6 })).rejects.toThrow();
  });
});

describe('review workflow + production guard', () => {
  beforeEach(() => __resetStore());

  it('an unreviewed item never ships; reviewing makes it shippable', async () => {
    const item = await insertItem(baseItem); // reviewedAt null
    expect((await getShippableItems()).map((i) => i.id)).not.toContain(item.id);

    await reviewItem(item.id, 'reviewer:alex');
    const shippable = await getShippableItems();
    expect(shippable.map((i) => i.id)).toContain(item.id);
    expect(shippable.find((i) => i.id === item.id)?.reviewedBy).toBe('reviewer:alex');
  });
});

describe('seed set provenance (no scraping — §6)', () => {
  it('every seed item has full attribution and plain text', () => {
    expect(SEED.length).toBeGreaterThan(0);
    for (const item of SEED) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
      expect(item.source.trim().length).toBeGreaterThan(0);
      expect(item.licence.trim().length).toBeGreaterThan(0);
      if (item.category === 'bdsm') {
        // Non-empty safety notes with a link to an established resource.
        expect(item.safetyNotes.trim().length).toBeGreaterThan(0);
        expect(item.safetyNotes).toMatch(/https?:\/\//);
      }
    }
  });

  it('seedContent inserts the seed set as UNREVIEWED (still needs human review)', async () => {
    __resetStore();
    await seedContent();
    const all = await store.getAllContentItems();
    expect(all.length).toBe(SEED.length);
    // Nothing ships until a human reviews it.
    expect(await getShippableItems()).toEqual([]);
  });
});

describe('drawable pool excludes unreviewed content (§6 guard, #3)', () => {
  beforeEach(() => __resetStore());

  it('only reviewed items both consented to are drawable', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await pairActive(a, b);

    const reviewed = await insertItem({ ...baseItem, title: 'Reviewed' });
    await reviewItem(reviewed.id, 'reviewer:alex');
    const unreviewed = await insertItem({ ...baseItem, title: 'Unreviewed' });

    // Both partners say yes to BOTH items.
    for (const id of [reviewed.id, unreviewed.id]) {
      await setAnswer(a, id, 'yes');
      await setAnswer(b, id, 'yes');
    }

    const result = await getDrawablePoolForUser(a);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The unreviewed item is filtered out even though both consented.
      expect(result.pool).toEqual([reviewed.id]);
      expect(await getShippableItemIds()).toContain(reviewed.id);
    }
  });

  it('requires an active pairing', async () => {
    const a = await newUser();
    const result = await getDrawablePoolForUser(a);
    expect(result.ok).toBe(false);
  });
});
