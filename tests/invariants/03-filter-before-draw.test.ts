/**
 * Non-negotiable #3 — Filter before draw.
 *
 * The random pick happens on an already-filtered array. We never draw then
 * reject. Structurally, `draw` takes no predicate — it cannot reject. This
 * test asserts that guarantee at the seam: every value `draw` returns was a
 * member of the pool it was handed.
 */
import { describe, it, expect } from 'vitest';
import { draw, drawExcluding } from '@/spin';

describe('invariant #3: filter before draw', () => {
  it('draw only ever returns a member of the given (already-filtered) pool', () => {
    const pool = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 10_000; i++) {
      const picked = draw(pool);
      expect(picked).not.toBeNull();
      expect(pool).toContain(picked);
    }
  });

  it('empty pool draws null rather than fabricating a result', () => {
    expect(draw([])).toBeNull();
  });

  it('no-repeat is pool removal, never post-draw rejection', () => {
    const pool = [{ id: 'x' }, { id: 'y' }];
    const drawn = new Set(['x']);
    for (let i = 0; i < 1_000; i++) {
      const picked = drawExcluding(pool, drawn, (it) => it.id);
      expect(picked).toEqual({ id: 'y' });
    }
  });
});
