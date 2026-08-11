/**
 * spin/ — the RNG + draw. No I/O, no DB imports. Pure and audit-trivial.
 * Pool computation lives in boundaries/, not here (CLAUDE.md §4).
 */
export { randomInt } from './rng';
export { draw, drawExcluding } from './draw';
