# `pairing/` — invite codes, pair state, unpair

Phase 2 — **implemented** (see docs/decisions/0007-phase-2-pairing.md):
- `invite.ts` — invite codes: 6 chars, 15-min expiry, single use (CLAUDE.md §5),
  drawn from an unambiguous alphabet with `crypto.getRandomValues()`
  (non-negotiable #6).
- `pairing.ts` — lifecycle: `createInvite` (one pairing per user), `redeemInvite`
  (→ **pending**; the redeemer's half of the dual confirmation), `confirmPairing`
  (issuer confirms → **active**), `getPairingView` (opacity-safe: partner id +
  status only), and `unpair`.
- **Unilateral unpair** (non-negotiable #7): instant, no approval, no delay, no
  notification to the other party beyond the pairing being gone. The store's
  `unpairUser` deletes the pairing and all its `sessions` + `session_draws` in a
  single transaction.

Routes (all gated with `withVerified`): `POST /api/pairing/invite`,
`/redeem`, `/confirm`, `/unpair`, and `GET /api/pairing`.

Invariants owned: **#7** (unilateral unpair + cascade delete).
Tests: `tests/invariants/07-unilateral-unpair.test.ts` and `tests/pairing/`.
