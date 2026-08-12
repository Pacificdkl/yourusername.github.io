# 0012 — Phase 7: privacy controls

- Status: accepted
- Date: 2026-08-11

## Context

Phase 7 (CLAUDE.md §7.7): data export, true delete, PIN/biometric lock, discreet
icon + app name. Non-negotiables touched: **#2** (no identity data in the
export), **#5** (own answers only), **#8** (no third-party reporters).

## Decisions

1. **Export is own-data-only, by construction.** `exportData` assembles the
   three permitted verification fields (no identity data), the caller's own
   boundary answers via `getBoundaryAnswers(userId)`, the caller's pairing
   summary, and the caller's session history. There is no path to a partner's
   answers. The test proves the account block has exactly the five permitted
   keys and that a partner's exclusive item never appears.

2. **True delete is a hard, atomic cascade (§7.7).** `store.deleteUser` removes
   the user row, credentials, challenges, magic tokens, email index, and
   boundary answers, and calls `unpairUser` first so the shared pairing and its
   sessions/draws are deleted too. No soft flag. The partner's own account
   survives — they are simply unpaired (which is also invariant #7's contract).

3. **PIN via PBKDF2, hash only.** PINs are low-entropy, so `pin.ts` uses
   PBKDF2-SHA256 with a per-PIN random salt and 200k iterations, storing
   `pbkdf2$iterations$salt$hash`. `users.pin_hash` holds the hash; the raw PIN
   is never stored or logged (mirrors §5's "hash only"). Verification is
   constant-time. Biometric unlock is delegated to the platform authenticator
   (the passkey layer), not reimplemented here.

4. **Discreet identity as a real manifest.** `app/manifest.ts` (a Next metadata
   route served at `/manifest.webmanifest`, already ungated by the middleware
   matcher) uses the neutral name "Spin", an empty description, and an abstract
   icon under `public/icons/` (also ungated). A test asserts the name reveals
   nothing suggestive.

5. **Delete requires an explicit confirm in the UI.** `PrivacyPanel` gates the
   irreversible delete behind a two-step confirm; the test verifies no delete
   call fires on the first click.

## Open / deferred

- Encryption at rest for `boundary_answers` / `session_draws` (ADR 0005) still
  open; it interacts with export/delete (export would decrypt; delete removes
  ciphertext).
- Per-couple configurable safeword (from Phase 6).
- Notifications are still not introduced, so invariant **#9**
  (`09-no-content-in-notifications`) remains `it.todo` — it belongs to whatever
  phase adds a notification surface (none here). This is the only remaining todo.
- The PIN unlock/lock SCREEN flow (auto-lock timer, unlock gate) is a thin UI
  addition on top of `/api/privacy/pin/verify`; the backend + set/verify are in
  place.

## Consequences

`lint`, `typecheck`, `test` (131 passing, 3 todo — only #9 remains), and `build`
all green. The gate test auto-covers the four new `/api/privacy/*` routes.
