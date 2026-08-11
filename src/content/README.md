# `content/` — library schema, seed data, review status

Phase 4 responsibilities:
- `content_items` schema + constraints (CLAUDE.md §5, §6).
- Review workflow: `reviewed_by` set and `reviewed_at IS NOT NULL` before an
  item can ship. A production pool query **never** returns unreviewed rows
  (migration guard).
- BDSM-category DB constraint: `safety_notes` must be non-empty (circulation,
  nerve compression, aftercare, never leaving a bound person alone, + a link to
  an established safety resource). Empty `safety_notes` in that category is a
  failed insert.

Seed sources — **do not scrape**. Public-domain only: Burton's 1883 *Kama
Sutra*, *Ananga Ranga*, *The Perfumed Garden*. Modern translations (e.g.
Doniger & Kakar 2002) are in copyright — excluded. Every record needs `source`
+ `licence` populated.

Descriptions: clear, plain, non-graphic, non-clinical.
