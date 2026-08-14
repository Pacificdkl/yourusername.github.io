# 0009 — Phase 4: content schema + seed

- Status: accepted
- Date: 2026-08-11

## Context

Phase 4 (CLAUDE.md §7.4, §6): the `content_items` schema, its constraints, the
review workflow, and an initial public-domain seed set. Content rules from §6
are hard invariants and each is tested.

## Decisions

1. **Constraints live in the DB, mirrored in the store.**
   `migrations/0002_content.sql` enforces: non-empty `source`/`licence`/`title`/
   `description`, `intensity`/`difficulty` in 1..5, and
   `bdsm_requires_safety_notes` (a BDSM row with empty `safety_notes` is a failed
   insert — §6). The in-memory store's `addContentItem` runs the same checks and
   throws, so dev/test behaviour matches Postgres. `tests/content` proves each
   violation fails.

2. **Review guard as a view (§6).** Unreviewed rows (`reviewed_at IS NULL`) must
   never reach the pool. In SQL that's the `shippable_content` view (and an RLS
   read policy) that request handlers read instead of the base table; in the
   store it's `getShippableContentItems`. `insertItem` always inserts
   **unreviewed** — nothing ships until `reviewItem` sets `reviewed_by` +
   `reviewed_at`.

3. **The drawable pool applies the guard (#3).** `getDrawablePoolForUser`
   intersects the consented pool (Phase 3 boundaries) with the shippable item
   ids, so unreviewed items can't be drawn even if both partners said yes. This
   is the §6 "pool query" guarantee, tested end to end. `GET /api/pool` exposes
   it; `GET /api/boundaries/pool` remains the raw consent view.

4. **Seed provenance (no scraping).** `seed.ts` draws only from public-domain
   Burton 1883 translations (Kama Sutra, Ananga Ranga, The Perfumed Garden) and
   commissioned original prose. Every record has `source` + `licence`;
   descriptions are plain and non-graphic. The one BDSM item carries full
   `safety_notes` + a resource link. Seed items are inserted **unreviewed** — a
   human editorial pass is still required (and is a launch gate, §7.8), so the
   seed represents provenance, not sign-off.

## Open / deferred

- Human editorial review of the seed set before production (Phase 8). The seed
  `reviewed_by` is intentionally unset.
- Real line art / a licensed stock library (§6) — not part of this text-only seed.
- pg adapter: point the pool query at `shippable_content`, and grant the
  request-handler role read only through it (writes via a separate editorial
  role).
- The `safety_notes`-must-contain-a-link rule is an editorial check (tested on
  the seed), not a DB CHECK; the DB enforces only non-emptiness.

## Consequences

`lint`, `typecheck`, `test` (81 passing, 3 todo — only #9 remains), and `build`
all green. The filesystem-driven gate test auto-covers `/api/content` and
`/api/pool`.
