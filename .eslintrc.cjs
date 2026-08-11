const path = require('node:path');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'spin'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'next/core-web-vitals',
  ],
  settings: {
    // Register the local plugin directory as the `spin` plugin.
    'import/resolver': { typescript: {} },
  },
  rules: {
    // Non-negotiable #6: enforced everywhere except test fixtures (below).
    'spin/no-math-random': 'error',
    // Allow intentionally-unused params/vars prefixed with _ (stub signatures
    // that must keep their shape ahead of Phase 1 implementation).
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    // App Router only — no /pages directory (see ADR 0002).
    '@next/next/no-html-link-for-pages': 'off',
  },
  overrides: [
    {
      // Test fixtures may use Math.random() to *prove* the app does not — e.g.
      // to generate comparison distributions. Nowhere else.
      files: ['tests/**/*.ts', '**/*.test.ts'],
      rules: {
        'spin/no-math-random': 'off',
      },
    },
  ],
  ignorePatterns: ['node_modules/', '.next/', 'dist/', 'tools/eslint-rules/'],
};
