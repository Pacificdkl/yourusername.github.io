# `auth/` — passkeys + magic-link fallback, sessions

Passkeys (WebAuthn) primary; email magic link fallback. **No passwords**
(CLAUDE.md §3).

Phase 1 responsibilities:
- WebAuthn registration + assertion
- Magic-link issuance/consumption (single use, short expiry)
- Session issuance and the `getSession()` helper used by the gate
- The **server-side verification gate** — as Next.js middleware **and** a
  per-route check (non-negotiable #1). Unverified sessions resolve only to the
  verification screen; every data route returns 403.

Invariants owned: **#1** (no content before verification).
Tests: `tests/invariants/01-gate.test.ts`.
