# 0011 — Phase 6: UI + session flow

- Status: accepted
- Date: 2026-08-11

## Context

Phase 6 (CLAUDE.md §7.6): wheel, result card, category selector, intensity-cap
slider, always-visible safeword and one-tap stop. Stack rules touched: Framer
Motion is wheel-only (§3), and no third-party fonts/scripts/SDKs (#8).

## Decisions

1. **The wheel is presentation only.** `Wheel.tsx` animates a spin but never
   decides the outcome — the result comes from `/api/session/spin` (the pure
   spin engine). Where the wheel visually lands is cosmetic. This keeps the
   randomness auditable in one place (`src/spin`) and out of the UI. The
   cosmetic rotation offset uses `randomInt` (CSPRNG), never `Math.random` (#6).

2. **Framer Motion isolation is tested, not just documented.**
   `tests/ui/framer-isolation.test.ts` scans `src/` and `app/` and fails if any
   file other than `Wheel.tsx` imports `framer-motion` (§3).

3. **Category + intensity are real session controls.** Rather than decorative
   widgets, the selector and slider push to `POST /api/session/config`
   (`updateSessionConfig`), which updates the active session; the change takes
   effect on the next spin. This required extending the session with a
   `categories` filter and a live-update path (with tests: category filtering
   and lowering the cap mid-session).

4. **Safeword + stop are always visible.** `SafewordBar` is fixed to the
   viewport for the whole session; one tap calls `/api/session/end`. The
   safeword is a default (`RED`) for now — per-couple configuration is a later
   refinement (noted below).

5. **No server code in the client bundle.** Client components import only
   `type`s from `@/db` / `@/session` (erased at build) and use a local
   `ALL_CATEGORIES` literal, so the store and services never reach the browser.

6. **Tests run in jsdom.** UI test files opt in with
   `// @vitest-environment jsdom`; Vitest uses the automatic JSX runtime
   (`esbuild.jsx: 'automatic'`) while tsconfig keeps `jsx: 'preserve'` for Next.
   Testing-library auto-cleanup isn't registered (globals off), so tests call
   `cleanup` in `afterEach`.

## Open / deferred

- Per-couple configurable safeword (currently defaults to `RED`).
- Persisting the pool-mode toggle (both-yes vs widening) in the UI — the backend
  defaults to both-yes for now.
- Visual/animation polish and accessibility audit of the wheel.
- No content push notifications are introduced here; the notification invariant
  (#9) remains for the phase that adds any notifications.

## Consequences

`lint`, `typecheck`, `test` (114 passing, 3 todo — only #9 remains), and `build`
all green. Home (`/`) now renders the session screen behind the verification
gate.
