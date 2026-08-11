# 0003 — Vitest, and the invariants suite as the gate

- Status: accepted
- Date: 2026-08-11

## Context

CLAUDE.md §2 says every non-negotiable "needs a test", §3 lists
`pnpm test:invariants` as a distinct command, and §4 places them under
`tests/invariants/` "one file each".

## Decision

- Test runner: **Vitest** (`pnpm test` → `vitest run`).
- `tests/invariants/` holds exactly one file per non-negotiable, numbered
  `01`–`09` to match CLAUDE.md §2. `pnpm test:invariants` runs only that folder.
- Where the underlying logic already exists (`spin/`, `boundaries/`, the
  dependency policy, the `Math.random` ban), the invariant test is **real and
  passing** now. Where it depends on unbuilt phases (gate, identity persistence,
  unpair, notifications), the file exists with `it.todo(...)` specs naming
  exactly what must be proven, so the checklist is visible and a phase cannot
  quietly skip it.

## Consequences

- CI runs `pnpm lint && pnpm typecheck && pnpm test`.
- A `todo` is not a pass: turning each into a real assertion is part of that
  phase's definition of done (CLAUDE.md §7 / §8 per-phase prompt).
