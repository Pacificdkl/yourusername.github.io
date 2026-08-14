# Spin

A mobile-first, installable **PWA for verified adult partners**. Two paired
accounts each set private boundaries; the app draws a uniformly random
suggestion from the intersection of what **both** consented to.

Not a native app. Not a content site. Not a recommender.

> **Authoritative guide:** [`CLAUDE.md`](./CLAUDE.md). Read it before writing any
> code. The nine **non-negotiables** in §2 are invariants — each has a test in
> [`tests/invariants/`](./tests/invariants).

## Status

**Phases 1–8 are built and green** (Phase 8 is compliance + the consent gate;
launch blockers remain — see below). Implemented:

- `src/consent/` — explicit Article 9 opt-in, **separate from T&Cs**, versioned
  and withdrawable; `withConsent` gates the special-category routes (§7.8).
- `src/privacy/` — data export (own data only; no identity, no partner
  answers), true delete (hard cascade + unpair), and a PBKDF2 PIN lock. Discreet
  installable identity via `app/manifest.ts` + a neutral icon.
- `src/ui/` — the session screen: the wheel (Framer Motion only, isolation
  tested), result card, category selector, intensity-cap slider (live session
  controls), and the always-visible safeword + one-tap stop. The wheel is
  presentation only — the pick is server-side. Plus a `/settings` privacy panel.
- `src/spin/` + `src/session/` — the pure CSPRNG draw (uniformity chi-square
  tested) driven by a real session: `intensityCap`, category filter, no-repeat
  as pool removal, and filter-before-draw over the drawable pool (invariant #3).
  `spin/` stays pure; `session/` is the I/O layer.
- `src/content/` — `content_items` schema with DB-level constraints (BDSM
  `safety_notes` required, provenance required, bounded ranges), the review
  workflow, the drawable pool that excludes unreviewed items (§6 guard), and a
  fully-attributed public-domain seed set.
- `src/boundaries/` — three-state per-user answers (own-only reads, the RLS
  analogue), the shared pool wired to the pure `computePool`, instant effect on
  edit, and the single shared read exposing item ids only (invariant #5).
- `src/pairing/` — invite codes (6 chars / 15 min / single use, CSPRNG), dual
  confirmation, one active pairing per user, and unilateral unpair with
  same-transaction cascade delete of shared session history (invariant #7).
- `src/auth/` — passkey auth + magic-link fallback, signed sessions, and the
  two-layer verification gate (`withVerified` per-route + edge `middleware.ts`)
  (invariant #1).
- `src/verify/` — `VerificationProvider` interface (stub + Persona adapter) and
  `verifyAndPersist`, which stores only age_verified/provider_ref/verified_at
  (invariant #2).
- `src/db/` — `UserStore` interface + in-memory impl (pg adapter deferred; the
  migration + RLS exist).
- `app/api/` — auth, verify, and a gated `/api/me` data route; `pnpm build` passes.
- `src/spin/` — pure CSPRNG + draw (invariants #3, #6).
- `src/boundaries/` — pure pool computation (invariants #4, #5).
- `tools/eslint-rules/no-math-random.js` — the custom lint rule (invariant #6).

Invariant tests `01`–`09` are all real and passing (**200 passing, 0 todo**).
`src/notifications` provides a contentless notification builder that makes #9
structurally enforceable.

The §7 build order is complete (Phases 1–8). Launch-blocker progress
(`docs/dpia.md`, `docs/security-review.md`):

- **Done:** at-rest encryption of `boundary_answers` / `session_draws` (ADR
  0005); security hardening — strict CSP + HSTS, rate limiting, CSRF same-origin;
  the DB schema (all tables migrated) with **RLS proven against real Postgres**
  via pglite; and the **full `PgStore` adapter** (`src/db/pg-store.ts`) — every
  store method verified against pglite, RLS-scoped ops + transactional cascades
  (ADR 0015).
- **Remaining:** production `pg.Pool` wiring (~20 lines) + a non-BYPASSRLS DB
  role; EU/UK region pinning; ICO registration + DPO sign-off; provider webhook
  signature verification; KMS-wrapped encryption key; nonce-based CSP.

## Merge gate (CLAUDE.md §9)

The six-item pre-merge checklist is automated in `tests/review/checklist.test.ts`
(no `Math.random()`; every gated route uses `withVerified`; no third-party
script/font CDN; every migration is reversible and doesn't widen RLS) and pinned
to behavioural proofs for the two judgement items (identity-in-logs → `02`,
opacity → `05`). CI (`.github/workflows/ci.yml`) runs `lint → typecheck → test →
build` on every push and PR. See [`docs/review-checklist.md`](./docs/review-checklist.md).

## Getting started

```bash
pnpm install
pnpm test           # vitest — the real invariant tests pass; todos are pending phases
pnpm test:invariants
pnpm lint           # eslint + the no-math-random rule
pnpm typecheck
pnpm dev            # next dev (once Phase 1 app/ routes exist)
```

> The invariant tests that exercise pure logic (`03`–`06`, `08`) run and pass
> without any services. `db:migrate` and the real provider adapters are stubs
> until Phase 1 — see [`docs/decisions/`](./docs/decisions).

## Layout

See CLAUDE.md §4. In short:

```
src/
  auth/  verify/  pairing/  boundaries/  spin/  content/  privacy/  ui/
tests/invariants/     # one file per non-negotiable (§2)
docs/decisions/       # ADRs
migrations/           # SQL migrations (+ SCHEMA.reference.sql)
tools/                # eslint rules, migrate runner
```

`spin/` stays pure and dependency-free so the randomness is trivially
auditable. Pool computation lives in `boundaries/`, not `spin/`.

## Build order

Phases 1–8 in CLAUDE.md §7. Do one phase at a time; end each with tests green
and an ADR. **Do not** start a later phase early.

## A note on hosting

The repo is named `*.github.io`, but this app needs a server runtime (Next.js
API routes) and Postgres, which GitHub Pages does not provide. It must deploy to
an EU/UK server host. See [`docs/decisions/0002-backend-framework.md`](./docs/decisions/0002-backend-framework.md).

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the pre-merge checklist in
CLAUDE.md §9.
