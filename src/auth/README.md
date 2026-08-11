# `auth/` — passkeys + magic-link fallback, sessions

Passkeys (WebAuthn) primary; email magic link fallback. **No passwords**
(CLAUDE.md §3).

Phase 1 — **implemented** (see docs/decisions/0006-phase-1-auth-gate.md):
- `passkey.ts` — WebAuthn registration + assertion via `@simplewebauthn/server`.
- `magic-link.ts` — single-use, hashed, 15-min magic-link fallback.
- `session.ts` — signed session cookie (Web Crypto HMAC; Node + Edge) and the
  `getSession()` helper.
- `gate.ts` — the **server-side verification gate**: `withVerified()` per-route
  check plus the coarse check used by root `middleware.ts` (non-negotiable #1).
  Unverified sessions resolve only to the verification screen; every data route
  returns 403. The gate re-reads `ageVerified` from the store each request, so a
  cookie can't forge verified status.

Invariants owned: **#1** (no content before verification).
Tests: `tests/invariants/01-gate.test.ts` (enumerates data routes, asserts 403
unauth + unverified, allows verified) and `tests/auth/auth.test.ts`.
