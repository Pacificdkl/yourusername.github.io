/**
 * CLAUDE.md §9 — "Review checklist before any merge", automated.
 *
 * Each item below is a merge gate. Items that can be enforced statically are
 * enforced here; the two that need judgement (identity in logs, opacity of NEW
 * response shapes) are pinned to their behavioural proofs (02, 05) and called
 * out in docs/review-checklist.md.
 *
 *   [1] No Math.random() outside test fixtures
 *   [2] No identity payload in any log, trace, or error body        (see 02)
 *   [3] Every new endpoint checks verification (and pairing) server-side
 *   [4] No new third-party script, SDK, or font CDN
 *   [5] Partner-boundary opacity holds for new response shapes       (see 05)
 *   [6] Migration is reversible and doesn't widen RLS
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function walk(dir: string, test: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, test));
    else if (test(full)) out.push(full);
  }
  return out;
}

const isSource = (f: string) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx');
const sourceFiles = [join(ROOT, 'src'), join(ROOT, 'app'), join(ROOT, 'middleware.ts')]
  .flatMap((p) => (statSync(p).isDirectory() ? walk(p, isSource) : [p]));

describe('§9 [1] no Math.random() outside test fixtures', () => {
  it('src/, app/, middleware.ts contain no Math.random(', () => {
    const offenders = sourceFiles.filter((f) => readFileSync(f, 'utf8').includes('Math.random('));
    expect(offenders).toEqual([]);
  });
});

describe('§9 [3] every gated API route checks verification server-side', () => {
  const API_DIR = join(ROOT, 'app', 'api');
  // Reachable pre-verification by design (auth flows + the verification flow).
  const UNGATED = ['/api/auth/', '/api/verify/'];

  const routeFiles = walk(API_DIR, (f) => /route\.tsx?$/.test(f));

  it('found routes to check', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  for (const file of routeFiles) {
    const routePath = '/api' + file.slice(API_DIR.length, file.lastIndexOf('/')).replace(/\\/g, '/');
    const gated = !UNGATED.some((p) => routePath === p.replace(/\/$/, '') || routePath.startsWith(p));
    if (!gated) continue;

    it(`${routePath} uses withVerified`, () => {
      const src = readFileSync(file, 'utf8');
      expect(src).toMatch(/withVerified\s*\(/);
    });
  }
});

describe('§9 [4] no new third-party script, SDK, or font CDN', () => {
  const BANNED = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    '@import url(http',
    'src="http', // external <script>/<img> src
    "src='http",
  ];
  it('no external font/script/CDN references in src or app', () => {
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      const text = readFileSync(f, 'utf8');
      for (const bad of BANNED) if (text.includes(bad)) offenders.push(`${f} :: ${bad}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('§9 [6] migrations are reversible and do not widen RLS', () => {
  const MIG_DIR = join(ROOT, 'migrations');
  const migrations = readdirSync(MIG_DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f));

  it('found numbered migrations', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  for (const name of migrations) {
    it(`${name} has a DOWN section and never disables RLS`, () => {
      const sql = readFileSync(join(MIG_DIR, name), 'utf8');
      expect(sql, 'missing -- DOWN section (reversibility)').toMatch(/--\s*DOWN/i);

      // No ACTIVE (uncommented) statement may disable RLS.
      const active = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
      expect(active).not.toMatch(/disable\s+row\s+level\s+security/i);
      expect(active).not.toMatch(/no\s+force\s+row\s+level\s+security/i);
    });
  }
});
