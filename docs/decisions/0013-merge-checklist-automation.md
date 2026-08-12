# 0013 — Automating the §9 merge checklist

- Status: accepted
- Date: 2026-08-11

## Context

CLAUDE.md §9 is a six-item "review checklist before any merge". A checklist that
lives only in prose is easy to skip. Where an item can be enforced by a machine,
it should be — so the gate is green/red, not a memory test.

## Decision

1. **Encode the checklist as tests** (`tests/review/checklist.test.ts`). Four of
   the six items are enforced statically:
   - [1] no `Math.random()` across `src/`, `app/`, `middleware.ts` (belt-and-
     braces with the ESLint rule);
   - [3] every gated `app/api/**/route.ts` uses `withVerified` (the
     pre-verification `/api/auth` and `/api/verify` flows are excluded);
   - [4] no external font/script/CDN URLs in source;
   - [6] every numbered migration has a `-- DOWN` section and no active
     `disable row level security`.

2. **Pin the two judgement items to their behavioural proofs.** Item 2
   (identity in logs) → `02-no-identity-data`; item 5 (opacity of new response
   shapes) → `05-boundary-opacity`. `docs/review-checklist.md` maps every item
   to its guard and lists the manual pointers for 2 and 5.

3. **Run the gate in CI** (`.github/workflows/ci.yml`): `lint → typecheck →
   test → build` on every push and PR. The custom `no-math-random` rule is wired
   via the existing `postinstall` symlink, so it runs in CI too.

## Consequences

- Adding a data route without `withVerified`, a migration without a `DOWN`, a
  `Math.random()`, or a CDN reference now fails CI rather than slipping through
  review.
- Items 2 and 5 still need a human eye for genuinely new shapes; the doc says
  exactly where to look.
- This is CLAUDE.md §9 (the merge checklist), not a Phase 9 — the build order
  (§7) ends at Phase 8 (security review + DPIA), which remains outstanding as a
  compliance/process step.

## Not covered

- `09-no-content-in-notifications` stays `it.todo` until a notification surface
  exists.
- At-rest encryption (ADR 0005) is a launch blocker tracked separately.
