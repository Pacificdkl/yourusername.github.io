/**
 * The draw. Pure, dependency-free (CLAUDE.md §4).
 *
 * Invariants enforced here:
 *  - #3 Filter before draw: `draw` operates on an already-filtered pool and
 *    NEVER inspects, rejects, or re-filters items. The caller (boundaries/)
 *    is responsible for producing the pool. Drawing then rejecting would leak
 *    excluded items through timing and logs — so it is structurally impossible
 *    in this module: there is no predicate parameter.
 *  - #6 CSPRNG: uniform selection via `randomInt`.
 */

import { randomInt } from './rng';

/**
 * Uniformly selects one element from a pre-filtered pool.
 *
 * @returns the drawn item, or `null` if the pool is empty.
 * @throws never inspects item contents — the pool is opaque here.
 */
export function draw<T>(pool: readonly T[]): T | null {
  if (pool.length === 0) return null;
  return pool[randomInt(pool.length)]!;
}

/**
 * Draw with no-repeat semantics implemented as pool removal, not
 * post-draw rejection (CLAUDE.md §7.5: "no-repeat as pool removal").
 *
 * The caller passes the already-drawn ids; we remove them from the pool
 * BEFORE drawing, preserving invariant #3.
 */
export function drawExcluding<T>(
  pool: readonly T[],
  alreadyDrawn: ReadonlySet<string>,
  idOf: (item: T) => string,
): T | null {
  const remaining = pool.filter((item) => !alreadyDrawn.has(idOf(item)));
  return draw(remaining);
}
