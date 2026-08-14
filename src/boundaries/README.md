# `boundaries/` — per-user item answers + pool computation

Phase 3 — **implemented** (see docs/decisions/0008-phase-3-boundaries.md):
- `pool.ts` — the pure, audited pool computation. A single `no` from either side
  excludes at every mode (invariant #4); returns item ids only (invariant #5).
- `service.ts` — the I/O layer:
  - `setAnswer` / `getMyAnswers` — a user's OWN three-state answers only (the
    RLS `user_id = current_user` analogue). No function returns a partner's
    answers.
  - `computeSharedPoolIds` — builds pairs from both partners' answers (an item
    counts only if BOTH answered it) and defers to `computePool`.
  - `getPoolForUser` — the single shared read: requires an ACTIVE pairing and
    returns item ids only.

Routes (gated with `withVerified`): `GET`/`PUT /api/boundaries` (own answers,
instant edit) and `GET /api/boundaries/pool` (shared pool, ids only).

Invariants owned: **#5** (boundary opacity), with **#3**/**#4** upheld by the
pure pool. Tests: `tests/invariants/05-boundary-opacity.test.ts` (endpoint-level)
and `tests/boundaries/`.

`spin/` stays pure; this module does the I/O and hands the spin engine a
filtered array.
