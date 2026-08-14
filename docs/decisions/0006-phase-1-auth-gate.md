# 0006 — Phase 1: auth + the verification gate

- Status: accepted
- Date: 2026-08-11

## Context

Phase 1 (CLAUDE.md §7.1 / §8): passkey auth with magic-link fallback, a
third-party age-assurance adapter, and a server-side verification gate on every
data route. Non-negotiables touched: **#1** (no content before verification) and
**#2** (no raw identity data).

## Decisions

1. **Two-layer gate.** `withVerified()` (src/auth/gate.ts) is the per-route
   check every data route must use; root `middleware.ts` is the coarse edge
   check. `tests/invariants/01-gate.test.ts` enumerates data routes from the
   filesystem and calls handlers directly (bypassing middleware), so a route
   that forgets `withVerified` fails CI. The gate loads `ageVerified` fresh from
   the store on every request — a session cookie can never assert verified
   status on its own.

2. **Session ≠ verification.** The signed cookie asserts only "user X"
   (HMAC-SHA256 over `userId.exp` via Web Crypto, so it runs in both Node and
   Edge). Verification is a separate, store-side fact.

3. **Identity minimisation by type (#2).** `VerificationResult` has exactly
   three fields; `verifyAndPersist()` is the only writer and calls
   `store.markVerified` with only provider_ref + verified_at.
   `02-no-identity-data.test.ts` drives the callback with an identity-laden
   payload and proves nothing but the three fields is stored and no identity
   value is logged.

4. **Storage seam.** The app depends on the `UserStore` interface (src/db). An
   in-memory store backs dev + tests. The **PostgreSQL adapter is deferred** —
   the migration and RLS already exist (migrations/0001_users.sql). This lets
   the invariant tests run without a live database. **Open:** wire `pg`, bind
   `app.current_user` per request for RLS, and refuse the in-memory store in
   production.

5. **Email stays out of the users table.** Magic-link resolves an address to a
   user via a SHA-256 **hash** only; the raw address is used to send the link
   and dropped. Keeps the users table identity-free (CLAUDE.md §5).

6. **Provider selection.** Stub for dev/test (refused when
   `NODE_ENV==='production'`), Persona adapter scaffolded. A second method is
   still required before launch (CLAUDE.md §3) — see ADR 0004.

## Open / deferred

- pg adapter + RLS request binding (decision 4).
- Real Persona network + webhook-signature verification (currently `TODO`).
- The callback is session-bound for the stub flow; a real provider's
  server-to-server webhook is signature-authenticated with no session.
- Full WebAuthn assertion verification needs a browser authenticator — covered
  by integration, not the unit suite; unit tests cover option generation +
  challenge storage.

## Consequences

`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass. Phase 1
invariant tests (01, 02) are real and green. **Do not start Phase 2** until
asked.
