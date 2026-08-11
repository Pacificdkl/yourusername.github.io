# `ui/` — React components

Phase 6 responsibilities (CLAUDE.md §7):
- The wheel (Framer Motion — the **only** place Framer Motion is used).
- Result card, category selector, intensity-cap slider.
- **Always-visible safeword and one-tap stop.**

The wheel animation is presentation only — the actual selection comes from
`src/spin` (CSPRNG). Never re-roll or bias the result in the UI layer.
