# `session/` — spin session orchestration

Phase 5 — **implemented** (see docs/decisions/0010-phase-5-spin-session.md).

The pure randomness lives in `src/spin` (RNG + `draw`, no I/O — §4). This module
is the I/O layer that drives it, so `spin/` stays trivially auditable:

- `startSession` — start (or resume) the active pairing's session with an
  `intensityCap` (1..5) and `noRepeat` flag; one active session per pairing.
- `spin` — draw one item. **Filter before draw (#3):** drawable pool
  (consented ∩ reviewed) → intensity cap → no-repeat removal → `draw()`. The
  only value handed to the CSPRNG is an already-filtered array; an empty pool
  returns `item: null` (exhausted), never a rejected candidate. Each draw is
  recorded in `session_draws`.
- `endSession` / `getActiveSessionView`.

No-repeat is implemented as **pool removal** (§7.5), not post-draw rejection.
Session history (`sessions` + `session_draws`) is deleted with the pairing on
unpair (invariant #7).

Routes (gated with `withVerified`): `POST /api/session/start`, `/spin`, `/end`,
and `GET /api/session`.

Tests: `tests/session/`; the draw's uniformity chi-square is in
`tests/invariants/06-csprng.test.ts`.
