# Contributing to Spin

Read [`CLAUDE.md`](./CLAUDE.md) first — especially §2 (non-negotiables) and §9
(pre-merge checklist). If a change conflicts with a non-negotiable, stop and
flag it rather than implementing it.

## Workflow

1. One phase at a time (CLAUDE.md §7). Re-read the non-negotiables, list which
   ones the phase touches, and **write those tests before the implementation**.
2. Keep `spin/` pure: no I/O, no DB imports, no framework imports.
3. Pool computation goes in `boundaries/`, never in `spin/`.
4. End each phase with `pnpm lint && pnpm typecheck && pnpm test` green and a
   new ADR in `docs/decisions/`.

## Before every commit

```bash
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm test` must pass before any commit (CLAUDE.md §3).

## The `no-math-random` rule

Non-negotiable #6: `Math.random()` is banned outside test fixtures. It is
enforced two ways:

- **Lint:** `tools/eslint-rules/no-math-random.js`, wired as the `spin` plugin
  in `.eslintrc.cjs`.
- **Test:** `tests/invariants/06-csprng.test.ts` scans `src/` for
  `Math.random(` so the ban holds even if lint is skipped.

> **Local plugin wiring:** ESLint's legacy config resolves plugins from
> `node_modules`. Until we move to flat config, wire the local plugin by
> symlinking (or `pnpm add -D`) `tools/eslint-rules` as `eslint-plugin-spin`.
> The test-suite scan in `06-csprng.test.ts` is the always-on backstop, so the
> invariant holds regardless. Migrating to `eslint.config.js` (flat) removes
> this wiring step — tracked for a future ADR.

## Pre-merge checklist (CLAUDE.md §9)

- [ ] No `Math.random()` outside test fixtures
- [ ] No identity payload in any log, trace, or error body
- [ ] Every new endpoint checks verification and pairing server-side
- [ ] No new third-party script, SDK, or font CDN
- [ ] Partner-boundary opacity holds for the new response shapes
- [ ] Migration is reversible and doesn't widen RLS

## Data & content rules

- Never persist raw identity data (invariant #2).
- Do not scrape content. Seed only from the public-domain sources in CLAUDE.md
  §6, with `source` + `licence` populated and `reviewed_by` set.
- Every BDSM item needs `safety_notes` (DB-enforced).
