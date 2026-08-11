# 0004 — Age assurance: provider adapter + stub

- Status: accepted (interface); provider selection OPEN
- Date: 2026-08-11

## Context

CLAUDE.md §3 mandates third-party age assurance only (Yoti, Persona, Veriff, or
Stripe Identity), offering at least two methods, and §2 forbids persisting any
raw identity data.

## Decision

- One `VerificationProvider` interface (`src/verify/provider.ts`) with two
  implementations to start: a `StubVerificationProvider` (dev/tests, never
  production) and one real adapter — **Persona** scaffolded as the first, chosen
  for its hosted flow and webhook model. A second method will be added before
  launch to satisfy the "at least two" requirement.
- The interface's `VerificationResult` has exactly three fields —
  `ageVerified`, `providerRef`, `verifiedAt` — so no implementation can pass
  identity data across the boundary (invariant #2 enforced by the type).

## Open

- Final production provider(s) and the second method are not yet chosen. Update
  this ADR when they are, and confirm against the Online Safety Act "highly
  effective age assurance" duties (CLAUDE.md §7.8).

## Consequences

- Real adapters carry `TODO(phase-1)` for network + signature verification.
- The stub must be refused when `NODE_ENV === 'production'` (composition root).
