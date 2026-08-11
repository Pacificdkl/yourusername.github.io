/**
 * Minimal migration runner — SCAFFOLD.
 *
 * Applies migrations/NNNN_*.sql in lexical order against DATABASE_URL, tracking
 * applied files in a `schema_migrations` table. Intentionally tiny and
 * dependency-light; swap for a real tool (e.g. node-pg-migrate) if the project
 * outgrows it — record that in docs/decisions/.
 *
 * Only *.sql files matching /^\d{4}_/ are applied. SCHEMA.reference.sql is
 * skipped by that pattern on purpose.
 *
 * TODO(phase-1): wire an actual pg client. Left unimplemented so the scaffold
 * has no runtime DB dependency yet.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

function pendingMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
}

function main(): void {
  const files = pendingMigrations();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. See .env.example.');
    process.exitCode = 1;
    return;
  }
  console.log(`Found ${files.length} migration(s):`);
  for (const f of files) console.log(`  - ${f}`);
  console.error('\nmigrate.ts is a scaffold stub — pg client not wired yet (see TODO).');
  process.exitCode = 1;
}

main();
