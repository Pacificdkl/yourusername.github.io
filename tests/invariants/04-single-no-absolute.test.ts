/**
 * Non-negotiable #4 — A single "No" is absolute.
 *
 * No setting can return a hard-limited item to the pool. We assert this across
 * EVERY pool mode.
 */
import { describe, it, expect } from 'vitest';
import { computePool, type ItemAnswers, type PoolMode } from '@/boundaries';

const MODES: PoolMode[] = ['both-yes', 'yes-and-maybe', 'maybe-and-maybe'];

describe('invariant #4: a single "No" is absolute', () => {
  it('a "no" from either side excludes the item at every setting', () => {
    const rows: ItemAnswers[] = [
      { itemId: 'a-no', a: 'no', b: 'yes' },
      { itemId: 'b-no', a: 'yes', b: 'no' },
      { itemId: 'both-no', a: 'no', b: 'no' },
      { itemId: 'no-and-maybe', a: 'no', b: 'maybe' },
    ];
    for (const mode of MODES) {
      const pool = computePool(rows, mode);
      expect(pool).toEqual([]);
    }
  });

  it('widening the mode never resurrects a no-ed item', () => {
    const rows: ItemAnswers[] = [{ itemId: 'x', a: 'no', b: 'yes' }];
    expect(computePool(rows, 'maybe-and-maybe')).not.toContain('x');
  });
});
