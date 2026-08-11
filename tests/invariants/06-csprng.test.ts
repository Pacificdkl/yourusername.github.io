/**
 * Non-negotiable #6 — crypto.getRandomValues() only.
 *
 * Two assertions:
 *  1. Static: no `Math.random(` appears anywhere under src/ (the lint rule
 *     enforces this in CI too; this is a belt-and-braces guard that runs in the
 *     test suite even if lint is skipped).
 *  2. Statistical: the draw is uniform. Chi-square goodness-of-fit over ~1e6
 *     draws across k buckets (CLAUDE.md §7.5).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from '@/spin';

const SRC_DIR = fileURLToPath(new URL('../../src', import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !full.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

describe('invariant #6: CSPRNG only', () => {
  it('no Math.random( anywhere under src/', () => {
    const offenders = walk(SRC_DIR).filter((f) =>
      readFileSync(f, 'utf8').includes('Math.random('),
    );
    expect(offenders).toEqual([]);
  });

  it('draw is uniform (chi-square over 1e6 draws)', () => {
    const k = 16;
    const n = 1_000_000;
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) counts[randomInt(k)]!++;

    const expected = n / k;
    let chi = 0;
    for (const c of counts) chi += (c - expected) ** 2 / expected;

    // df = 15. A uniform generator scores ~15 on average; the critical value
    // at p≈1e-6 is ~62. A biased generator blows far past this. Threshold set
    // high enough that flakes are astronomically unlikely.
    expect(chi).toBeLessThan(62);
  });

  it('randomInt covers the full [0, max) range', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i++) seen.add(randomInt(10));
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('randomInt rejects non-positive / non-integer bounds', () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(-1)).toThrow(RangeError);
    expect(() => randomInt(2.5)).toThrow(RangeError);
  });
});
