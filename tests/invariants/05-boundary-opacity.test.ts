/**
 * Non-negotiable #5 — Boundary opacity.
 *
 * Partner A's per-item answers are never readable by Partner B through any
 * endpoint, response shape, or error message. The only shared read is the
 * resulting pool.
 *
 * At the pure-logic layer we assert the shared computation returns ids only —
 * never per-side answers. Phase 3 adds endpoint/response-shape tests.
 */
import { describe, it, expect } from 'vitest';
import { computePool, type ItemAnswers } from '@/boundaries';

describe('invariant #5: boundary opacity', () => {
  it('computePool returns item ids only — never per-side answers', () => {
    const rows: ItemAnswers[] = [
      { itemId: 'shared', a: 'yes', b: 'yes' },
      { itemId: 'a-said-no', a: 'no', b: 'yes' },
    ];
    const pool = computePool(rows, 'both-yes');
    expect(pool).toEqual(['shared']);
    // The result is a flat string[]; there is no field that reveals how either
    // side answered any item.
    for (const entry of pool) {
      expect(typeof entry).toBe('string');
    }
  });

  it.todo('no endpoint response includes the partner\'s raw answers');
  it.todo('error messages never disclose which side excluded an item');
});
