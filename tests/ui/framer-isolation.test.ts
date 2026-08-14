/**
 * Stack rule (CLAUDE.md §3): Framer Motion is used for the wheel ONLY. This
 * scans every UI/app source file and asserts the sole `framer-motion` importer
 * is src/ui/Wheel.tsx.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCAN_DIRS = ['src', 'app'];
const ALLOWED = join(ROOT, 'src', 'ui', 'Wheel.tsx');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('Framer Motion isolation (§3)', () => {
  it('only Wheel.tsx imports framer-motion', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        if (file === ALLOWED) continue;
        if (readFileSync(file, 'utf8').includes('framer-motion')) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
