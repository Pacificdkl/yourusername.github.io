-- SCHEMA.reference.sql — NON-EXECUTED reference for the full data model
-- (CLAUDE.md §5). Real migrations are added phase by phase (0001_*, 0002_*, …).
-- This file documents the target so reviewers can see the whole shape; it is
-- NOT run by `pnpm db:migrate`.

-- Phase 2 — pairing
-- pairings(id, user_a, user_b, status, created_at)   -- one active per user
-- invite_codes(code, issuer, expires_at, consumed_at) -- 6 chars, 15 min, single use

-- Phase 3 — boundaries
-- boundary_answers(user_id, item_id, answer)          -- yes | maybe | no
--   RLS: readable only by user_id = current_user. Never by partner, never by a
--   service role used in request handlers. Encrypt at rest; evaluate
--   client-side encryption before shipping (docs/decisions/).

-- Phase 4 — content
-- content_items(id, title, category, description, intensity, difficulty,
--               tags[], safety_notes, source, licence, reviewed_by, reviewed_at)
--   Constraint: BDSM-category rows must have non-empty safety_notes.
--   Pool query in production must exclude reviewed_at IS NULL.

-- Phase 5/6 — sessions
-- sessions(id, pairing_id, intensity_cap, no_repeat, started_at, ended_at)
-- session_draws(session_id, item_id, drawn_at)
--   Encrypt session_draws at rest. Deleted with the pairing (invariant #7).

-- Phase 7 — favourites
-- favourites(user_id, item_id)
