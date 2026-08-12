# `ui/` — React components

Phase 6 — **implemented** (see docs/decisions/0011-phase-6-ui.md):
- `Wheel.tsx` — the wheel. **The only component that imports Framer Motion**
  (§3), enforced by `tests/ui/framer-isolation.test.ts`. Presentation only: the
  wheel never picks or biases the result — the pick is server-side
  (`/api/session/spin`); the cosmetic rotation uses the CSPRNG, not
  `Math.random` (#6).
- `ResultCard.tsx` — the drawn item; safety notes shown prominently, attribution
  (source + licence) always shown.
- `CategorySelector.tsx` / `IntensitySlider.tsx` — session controls; changes are
  pushed to `/api/session/config` and take effect on the next spin.
- `SafewordBar.tsx` — the always-visible safeword + one-tap stop, fixed to the
  viewport, ending the session immediately.
- `SpinSession.tsx` (`'use client'`) — the container: loads pairing/session,
  spins, shows the result, wires the controls, and handles the
  paired / not-paired / no-session states. Rendered from the home page.

No third-party fonts, scripts, or SDKs (#8) — Tailwind only.

Tests: `tests/ui/` (jsdom).
