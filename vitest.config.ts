import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Use the automatic JSX runtime so tests don't need React in scope
  // (tsconfig keeps jsx: "preserve" for the Next build).
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts'],
    // The invariants suite is the gate. It must stay fast and deterministic
    // (except the spin uniformity test, which is intentionally heavy).
    testTimeout: 30_000,
  },
});
