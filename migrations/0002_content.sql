-- 0002_content.sql — Phase 4 (content schema + review guard).
-- Reversible: see the DOWN section.
--
-- Enforces the §6 invariants at the database level:
--   * provenance (source, licence) is mandatory,
--   * BDSM items must carry non-empty safety_notes (failed insert otherwise),
--   * intensity/difficulty are bounded,
--   * unreviewed rows (reviewed_at IS NULL) never reach the pool — enforced by
--     querying the `shippable_content` view, not the base table.

-- UP
create table if not exists content_items (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (btrim(title) <> ''),
  category     text not null check (category in ('position','massage','sensation','bdsm','roleplay')),
  description  text not null check (btrim(description) <> ''),
  intensity    smallint not null check (intensity between 1 and 5),
  difficulty   smallint not null check (difficulty between 1 and 5),
  tags         text[] not null default '{}',
  safety_notes text not null default '',
  source       text not null check (btrim(source) <> ''),
  licence      text not null check (btrim(licence) <> ''),
  reviewed_by  text,
  reviewed_at  timestamptz,
  -- §6: a BDSM item with empty safety_notes is a failed insert.
  constraint bdsm_requires_safety_notes
    check (category <> 'bdsm' or btrim(safety_notes) <> '')
);

-- The ONLY view request handlers may read from for the pool. Excludes
-- unreviewed rows so they can never be drawn (§6 migration guard).
create or replace view shippable_content as
  select * from content_items
  where reviewed_at is not null and reviewed_by is not null;

-- RLS: content is shared, read-only to request handlers; writes go through a
-- separate editorial role. Enabled here; policies granted in the editorial
-- migration (not part of the request-handler role).
alter table content_items enable row level security;
create policy content_read_shippable on content_items
  for select using (reviewed_at is not null and reviewed_by is not null);

-- DOWN
-- drop policy content_read_shippable on content_items;
-- drop view shippable_content;
-- drop table content_items;
