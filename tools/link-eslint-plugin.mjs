/**
 * Wire the local ESLint rules as `eslint-plugin-spin` so legacy .eslintrc can
 * resolve them (ESLint 8 resolves plugins from node_modules only).
 *
 * Runs on `postinstall`. Idempotent. When we migrate to flat config
 * (eslint.config.js) this whole shim can be deleted — tracked in CONTRIBUTING.md.
 */
import { mkdirSync, rmSync, symlinkSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, 'tools', 'eslint-rules');
const linkPath = join(root, 'node_modules', 'eslint-plugin-spin');

try {
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  if (existsSync(linkPath) || safeIsSymlink(linkPath)) {
    rmSync(linkPath, { recursive: true, force: true });
  }
  // 'junction' is used on Windows (no admin needed); ignored elsewhere.
  symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  console.log('linked eslint-plugin-spin -> tools/eslint-rules');
} catch (err) {
  // Non-fatal: lint will complain, but the test-suite scan in
  // tests/invariants/06-csprng.test.ts still enforces the no-Math.random rule.
  console.warn('could not link eslint-plugin-spin:', err?.message ?? err);
}

function safeIsSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
