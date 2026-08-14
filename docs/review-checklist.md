# Review checklist before any merge (CLAUDE.md §9)

Each item is a **merge gate**. Four are enforced automatically by
`tests/review/checklist.test.ts`; the two that need human judgement are pinned to
the behavioural test that proves them and must still be eyeballed for genuinely
new shapes. CI (`.github/workflows/ci.yml`) runs `lint → typecheck → test →
build` on every push and PR.

| # | Checklist item | Enforcement |
|---|----------------|-------------|
| 1 | No `Math.random()` outside test fixtures | **Automated** — the `no-math-random` ESLint rule (project-wide, test override) **and** `checklist.test.ts` scans all of `src/`, `app/`, `middleware.ts`. |
| 2 | No identity payload in any log, trace, or error body | **Behavioural** — `tests/invariants/02-no-identity-data.test.ts` drives the verification callback with an identity-laden payload and asserts nothing but the three permitted fields is stored and none is logged. New logging near verification must be reviewed by hand. |
| 3 | Every new endpoint checks verification (and pairing) server-side | **Automated** — `checklist.test.ts` scans every `app/api/**/route.ts` (excluding the pre-verification `/api/auth` and `/api/verify` flows) and requires `withVerified(`. `01-gate.test.ts` additionally calls every data route and asserts 403 when unauthenticated/unverified. Pairing-scoped endpoints enforce an active pairing in their service (`getPoolForUser`, session flow). |
| 4 | No new third-party script, SDK, or font CDN | **Automated** — `08-no-third-party.test.ts` denylists telemetry packages in `package.json`; `checklist.test.ts` scans source for external font/script/CDN URLs. |
| 5 | Partner-boundary opacity holds for the new response shapes | **Behavioural** — `05-boundary-opacity.test.ts` proves own-only reads and ids-only pool responses at the endpoint level. Any **new** response shape that touches boundary data must add its own opacity assertion. |
| 6 | Migration is reversible and doesn't widen RLS | **Automated** — `checklist.test.ts` requires every numbered migration to carry a `-- DOWN` section and to contain no active `disable row level security` / `no force row level security`. |

## Manual review pointers (items 2 and 5)

- **Item 2:** grep the diff for any new `console.*` or error body near
  `verify/`, `auth/`, and the verification callback. The users table has no
  identity column, so the main risk is transient handling — keep it out of logs.
- **Item 5:** for any endpoint that reads `boundary_answers` or joins both
  partners, confirm the response type is ids-only (or the caller's own answers),
  and that error messages don't disclose which side excluded an item.

## Status of the invariant suite

All nine non-negotiables now have real, passing tests (`01`–`09`); at-rest
encryption (ADR 0005) and the pg adapter + RLS (ADR 0015) are implemented and
tested. Remaining work is operational (region pinning, ICO/DPO sign-off,
provider webhook signatures, KMS key, production pg role) — tracked in
`docs/dpia.md` and `docs/security-review.md`, not per-merge items.
