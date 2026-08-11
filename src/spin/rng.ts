/**
 * Cryptographically secure random integer generation.
 *
 * Non-negotiable #6 (CLAUDE.md §2): only `crypto.getRandomValues()`.
 * This module is pure and dependency-free (CLAUDE.md §4): no I/O, no DB.
 */

/**
 * Returns a uniformly distributed integer in [0, max) using rejection
 * sampling to avoid modulo bias.
 *
 * @param max exclusive upper bound; must be a positive safe integer.
 */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError(`randomInt: max must be a positive integer, got ${max}`);
  }
  // 32-bit draws. Reject values in the final incomplete bucket so every
  // result in [0, max) is equally likely (no modulo bias).
  const range = 0x1_0000_0000; // 2^32
  const limit = range - (range % max);
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % max;
}
