# 0007 — Phase 2: pairing

- Status: accepted
- Date: 2026-08-11

## Context

Phase 2 (CLAUDE.md §7.2): invite codes (6 chars, 15 min, single use), dual
confirmation, one active pairing per user, and unilateral unpair with cascade
delete. Non-negotiables touched: **#7** (unilateral unpair), **#6** (CSPRNG for
codes), **#1** (new endpoints are gated).

## Decisions

1. **Dual confirmation = redeem + issuer confirm.** Generating an invite is not
   the same as confirming a specific partner (the issuer doesn't know who will
   redeem). So: `redeemInvite` creates a **pending** pairing and counts as the
   redeemer's confirmation (`confirmedB`); the issuer then calls
   `confirmPairing` (`confirmedA`) to make it **active**. Both sides thus take an
   explicit action against *this* pairing. A pending pairing already occupies the
   "one per user" slot, preventing concurrent proposals; either party can
   `unpair` out of a stuck pending state.

2. **One pairing per user** is enforced by `getPairingForUser` returning any
   non-ended (pending or active) pairing, checked in both `createInvite` and
   `redeemInvite` (including a re-check of the issuer at redeem time to close the
   race where the issuer paired with someone else after issuing).

3. **Single-use codes are claimed atomically.** `store.consumeInvite` marks the
   code consumed and returns it in one step; a lost race reads back as
   `invalid_code`. Codes use an unambiguous alphabet (no 0/O/1/I/L) and
   `crypto.getRandomValues()` (#6).

4. **Unilateral unpair is one transaction (#7).** `store.unpairUser(userId)`
   finds the user's pairing and deletes it together with every `session` and
   `session_draw` under it, in a single synchronous critical section (the
   in-memory analogue of a DB transaction). No approval, no delay, and the
   result reports only removed ids — there is no notification path, so the other
   party learns of it solely by the pairing being gone. `sessions` /
   `session_draws` exist in the store now (though full session lifecycle is Phase
   5/6) precisely so the cascade is real and tested.

5. **Opacity-safe reads (#5).** `getPairingView` / `GET /api/pairing` return only
   `{ pairingId, partnerId, status }`. Failure reasons on confirm collapse
   `not_a_member` into `not_found` so membership isn't disclosed.

## Consequences

- `tests/invariants/07-unilateral-unpair.test.ts` is now real: either-side
  unpair, immediate effect, cascade delete of sessions + draws, and the
  no-notification contract.
- The filesystem-driven gate test (01) automatically covers the five new
  `/api/pairing/*` routes.
- `lint`, `typecheck`, `test` (50 passing, 5 todo), and `build` all green.

## Open / deferred

- pg adapter must implement `unpairUser` as a real SQL transaction with
  `ON DELETE CASCADE` (or explicit deletes) so the same-transaction guarantee
  holds under Postgres.
- A pg `UNIQUE` partial index should enforce one non-ended pairing per user at
  the database level, not just in application code.
