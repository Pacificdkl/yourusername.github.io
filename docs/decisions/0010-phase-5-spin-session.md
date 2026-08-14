# 0010 — Phase 5: spin engine + session flow

- Status: accepted
- Date: 2026-08-11

## Context

Phase 5 (CLAUDE.md §7.5): pure spin module, CSPRNG, uniformity test over ~1e6
draws, no-repeat as pool removal. The pure module (`src/spin`) and its
chi-square uniformity test already landed with the scaffold. This phase adds the
session flow that drives it. Non-negotiables touched: **#3** (filter before
draw), **#6** (CSPRNG), **#7** (session history), **#1** (gated endpoints).

## Decisions

1. **`spin/` stays pure; orchestration is a new `src/session/`.** §4 says `spin/`
   has no I/O and no DB imports. The session flow needs both, so it lives in
   `src/session/` and imports `draw` from `spin`. This mirrors the boundaries
   split (pure `pool.ts` + I/O `service.ts`). `src/session/` is not in the §4
   sketch; the sketch is illustrative and keeping the spin engine pure is the
   invariant that matters (it's how the randomness stays trivially auditable).

2. **Filter before draw is structural (#3).** `spin()` builds the pool in
   stages — drawable (consented ∩ reviewed, from Phase 3/4) → intensity cap →
   no-repeat removal — and only then calls `draw()` on the resulting array.
   `draw()` takes no predicate, so it cannot reject; an empty pool yields
   `item: null`. The test spins hundreds of times and asserts every result is in
   the expected filtered set and never an excluded (unreviewed / no-ed /
   over-cap) item.

3. **No-repeat = pool removal (§7.5).** When `noRepeat` is set, already-drawn
   ids are removed from the pool before the draw, so a session draws each item
   once and then exhausts — verified by drawing the whole set and getting `null`
   next.

4. **One active session per pairing.** `startSession` resumes the existing
   active session if present (idempotent), else creates one. Config is
   `intensityCap` (clamped 1..5) and `noRepeat` (default true). Pool mode is
   both-yes for now — the widening toggle isn't in the `sessions` schema and is
   deferred to Phase 6.

5. **Draws are recorded; the cascade is now real.** Each draw writes a
   `session_draws` row, so the unilateral-unpair cascade (invariant #7, Phase 2)
   now deletes genuine draw history, not just synthetic rows.

## Open / deferred

- The intensity-cap SLIDER, result card, wheel, and always-visible safeword /
  one-tap stop are Phase 6 UI.
- Persisting the pool-mode toggle per session (add a column) — Phase 6.
- pg adapter: `sessions` / `session_draws` tables + the unpair transaction
  already sketched in ADR 0007; `session_draws` should be encrypted at rest
  (§5), tracked with ADR 0005.

## Consequences

`lint`, `typecheck`, `test` (97 passing, 3 todo — only #9 remains), and `build`
all green. The gate test auto-covers the four new `/api/session*` routes.
