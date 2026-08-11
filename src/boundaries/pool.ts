/**
 * Pool computation (CLAUDE.md §4, §5). Pure — no DB, no I/O.
 *
 * Invariants:
 *  - #3 Filter before draw: this produces the filtered array the spin engine
 *    draws from.
 *  - #4 A single "No" is absolute: any `no` from either side removes the item
 *    unconditionally, at EVERY setting. No flag can override it.
 *  - #5 Boundary opacity: input holds both answers, but `computePool` returns
 *    only item ids — never which side answered what.
 *
 * Pool rule (default both-Yes):
 *   both-yes        → include only if a === 'yes' && b === 'yes'
 *   yes-and-maybe   → include if each side is 'yes' or 'maybe'
 *   maybe-and-maybe → same admissible set as yes-and-maybe (both must be at
 *                     least 'maybe'); named per the CLAUDE.md toggle wording.
 * In all cases a single 'no' excludes.
 */

import type { Answer, ItemAnswers, PoolMode } from './types';

function atLeastMaybe(answer: Answer): boolean {
  return answer === 'yes' || answer === 'maybe';
}

function admits(mode: PoolMode, a: Answer, b: Answer): boolean {
  // Invariant #4: a single "No" is absolute, checked first and unconditionally.
  if (a === 'no' || b === 'no') return false;

  switch (mode) {
    case 'both-yes':
      return a === 'yes' && b === 'yes';
    case 'yes-and-maybe':
    case 'maybe-and-maybe':
      return atLeastMaybe(a) && atLeastMaybe(b);
  }
}

/**
 * Returns the ids of items in the shared pool. Order is preserved from input;
 * callers must not rely on it as randomness (that is the spin engine's job).
 *
 * The return type is deliberately `string[]` — not the answers — so no
 * endpoint built on this can leak per-side boundaries (invariant #5).
 */
export function computePool(
  answers: readonly ItemAnswers[],
  mode: PoolMode = 'both-yes',
): string[] {
  return answers
    .filter((row) => admits(mode, row.a, row.b))
    .map((row) => row.itemId);
}
