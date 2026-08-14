# 0008 — Phase 3: boundaries

- Status: accepted
- Date: 2026-08-11

## Context

Phase 3 (CLAUDE.md §7.3): three-state answers, pool computation, opacity tests,
instant effect on edit. Non-negotiables touched: **#5** (boundary opacity),
**#3**/**#4** (filter before draw / a single "no" is absolute, via the pure
pool), **#1** (new endpoints gated).

## Decisions

1. **Opacity by construction (#5).** The service exposes exactly two reads:
   `getMyAnswers` (the caller's OWN answers) and `getPoolForUser` (item ids
   only). There is deliberately **no** function or route that returns a
   partner's answers. `store.getBoundaryAnswers(userId)` returns only that
   user's rows — the in-memory analogue of the RLS rule
   `boundary_answers.user_id = current_user`. `05-boundary-opacity.test.ts` now
   drives the real routes: a user's read shows only their own answers, the pool
   read is ids-only with no per-side field and no error reason, an edit changes
   the pool immediately, and a single "no" excludes at every mode.

2. **Reuse the audited pool.** `computeSharedPoolIds` builds `ItemAnswers` pairs
   from the two partners' stored answers and defers to the pure `computePool`
   (tested in `04`). An item is considered only if BOTH partners have answered
   it; a missing answer means "no consent yet" and the item is absent — which
   for both-yes and the widening modes yields the same result as treating the
   intersection, while keeping `computePool` unchanged.

3. **Pool read requires an ACTIVE pairing.** Pending or absent → `not_paired`
   (409). This leaks no boundary data either way. The shared pool is the only
   cross-partner read (#5).

4. **Instant edit (§7.3).** `setBoundaryAnswer` is an upsert; the next pool read
   reflects it with no caching or delay.

5. **Answers survive unpair.** Boundary answers are per-user private data, not
   shared session history, so `unpair` (#7) does not delete them. True deletion
   of a user's own data is Phase 7 (privacy).

## Open / deferred

- Encryption of `boundary_answers` at rest / client-side encryption is still
  **open** — see ADR 0005. The service is written to be agnostic: it operates on
  decrypted `{ itemId, answer }` rows and returns ids only, so either choice can
  wrap it.
- The pool-mode toggle (both-yes vs widening) is currently a request parameter
  defaulting to both-yes. Persisting it per pairing/session is Phase 5/6.
- pg adapter must enforce the RLS policy so a service role in a request handler
  cannot read another user's answers.

## Consequences

`lint`, `typecheck`, `test` (66 passing, 3 todo — only #9 remains), and `build`
all green. The filesystem-driven gate test auto-covers the new
`/api/boundaries` routes.
