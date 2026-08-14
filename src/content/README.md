# `content/` — library schema, seed data, review status

Phase 4 — **implemented** (see docs/decisions/0009-phase-4-content.md):
- Schema: `content_items` (CLAUDE.md §5) with DB-level constraints in
  `migrations/0002_content.sql` — non-empty `source`/`licence`, bounded
  `intensity`/`difficulty`, and `bdsm_requires_safety_notes`. The in-memory
  store mirrors these so a bad insert fails the same way in dev/tests.
- `service.ts` — `insertItem` (unreviewed; throws on constraint violation),
  `reviewItem` (the ship gate), `getShippableItems` / `getShippableItemIds`
  (reviewed rows only).
- `drawable.ts` — `getDrawablePoolForUser` = consented pool (boundaries) ∩
  reviewed items. This is the §6 "pool query": unreviewed rows never reach the
  draw (#3).
- `seed.ts` — the initial seed set from **public-domain** sources (Burton's 1883
  translations) and commissioned original prose, each fully attributed, plain
  and non-graphic, inserted **unreviewed**. The BDSM item carries `safety_notes`
  (circulation, nerve compression, aftercare, never leaving a bound person
  alone) plus a link to an established resource.

Routes (gated with `withVerified`): `GET /api/content` (shippable library) and
`GET /api/pool` (drawable pool, ids only).

Do **not** scrape. Every record needs `source` + `licence` populated and
`reviewed_by` set before it can ship. A production pool query never returns
`reviewed_at IS NULL` rows (enforced by the `shippable_content` view / RLS).

Tests: `tests/content/`.
