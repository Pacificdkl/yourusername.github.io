# 0002 — Single framework: Next.js App Router

- Status: accepted
- Date: 2026-08-11

## Context

CLAUDE.md §3 lists the frontend as "React 18 + TypeScript, Vite" and the
backend as "Next.js App Router API routes (or Node/Express if separated — pick
once, record it here)." Vite and Next.js are two different build/runtime
toolchains; running both adds surface area for no benefit here.

Non-negotiable #1 requires the verification gate to be enforced server-side on
every data route, as middleware **and** per-route. Co-locating UI and API in one
framework makes that gate a single, auditable boundary.

## Decision

Use **Next.js App Router** as the single framework for both the UI and the API
routes. Do not add Vite. Framer Motion remains, used **only** for the wheel
(CLAUDE.md §3). The `pnpm dev` command maps to `next dev`.

This supersedes the "Vite" mention in §3 for the frontend build tool.

## Consequences

- One toolchain, one middleware layer for the gate.
- `src/` holds framework-agnostic domain logic (`spin/`, `boundaries/`,
  `verify/`, …); the Next.js `app/` routes (added in Phase 1) import from it.
- `spin/` stays pure and free of any Next.js import (CLAUDE.md §4).
- Hosting must be an EU/UK region that supports Next.js server runtime; verify
  the Postgres region too (CLAUDE.md §3).

## Note on hosting

The repository is named `*.github.io`, but GitHub Pages serves **static** files
only and cannot run Next.js server routes or Postgres. This app is not a Pages
site; a server host in an EU/UK region is required. Flagged here so the name
does not mislead deployment.
