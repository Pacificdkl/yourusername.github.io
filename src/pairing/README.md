# `pairing/` — invite codes, pair state, unpair

Phase 2 responsibilities:
- Invite code generation: 6 chars, 15 min expiry, single use (CLAUDE.md §5).
  Codes drawn with `crypto.getRandomValues()` (non-negotiable #6).
- Dual confirmation to form a pairing; one active pairing per user.
- **Unilateral unpair** (non-negotiable #7): instant, no approval, no delay, no
  notification to the other party beyond the pairing being gone. Shared session
  history (`sessions`, `session_draws`) deleted in the **same transaction**.

Invariants owned: **#7** (unilateral unpair + cascade delete).
Tests: `tests/invariants/07-unilateral-unpair.test.ts`.
