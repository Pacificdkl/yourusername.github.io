# 0014 — Phase 8: security review, DPIA, and Article 9 consent

- Status: accepted (docs + consent gate); launch blockers OPEN
- Date: 2026-08-11

## Context

Phase 8 (CLAUDE.md §7.8): sexual-life data is UK GDPR Article 9 special category.
Requires a separate explicit opt-in distinct from T&Cs, a completed DPIA + ICO
registration before launch, and confirmation of Online Safety Act "highly
effective age assurance" duties.

## Decisions

1. **Explicit Article 9 consent as a real gate.** `src/consent` records a
   versioned, unbundled, withdrawable consent (`consent_version` +
   `consent_granted_at` on the user) and exposes `withConsent`, which composes
   the verification gate with a consent check. Special-category routes
   (boundaries, pool, content, session) use `withConsent`; account/pairing/
   privacy routes stay `withVerified` so a user can still verify, view status,
   export, delete, and withdraw. The consent screen in the UI states it is
   separate from any T&Cs and withdrawable. Tests in `tests/consent`.

2. **`withConsent` still satisfies the §9 verification gate.** It builds on
   `getVerifiedUser`, so verification is enforced first (unauthenticated →
   `verification_required`, verified-but-not-consented → `consent_required`).
   The §9 checklist test was updated to accept `withVerified` OR `withConsent`.

3. **DPIA and security review are living documents** (`docs/dpia.md`,
   `docs/security-review.md`), written against the current code and explicitly
   marking launch blockers. They are the deliverable of this phase together with
   the consent gate — the rest of Phase 8 (ICO registration, DPO sign-off,
   provider HEAA assessment) is organisational, not code.

## Launch blockers recorded (not closed here)

- Encryption at rest for `boundary_answers` / `session_draws` (ADR 0005).
- PostgreSQL adapter with RLS actually enforced (the store is in-memory).
- EU/UK region pinned + verified; sub-processor DPAs; ICO registration; DPO
  sign-off; provider webhook signature verification; CSRF + rate limiting + CSP.

## Consequences

`lint`, `typecheck`, `test` (165 passing, 3 todo — only #9), and `build` all
green. The invariant suite is complete except `09` (needs a notification surface
that doesn't exist). This closes the §7 build order at Phase 8; remaining work is
the launch-blocker list above, tracked in the DPIA and security review.
