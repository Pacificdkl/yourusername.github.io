-- 0005_sessions.sql — Phase 5/6 (sessions) + favourites. Reversible: see DOWN.

-- UP
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  pairing_id    uuid not null references pairings(id) on delete cascade,
  intensity_cap smallint not null check (intensity_cap between 1 and 5),
  no_repeat     boolean not null default true,
  categories    text[],                        -- null = all categories
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);

create table if not exists session_draws (
  session_id uuid not null references sessions(id) on delete cascade,
  -- Ciphertext at rest (§5): the item id reveals what was suggested, so it is
  -- encrypted; hence text, not a uuid FK to content_items.
  item_id    text not null,
  drawn_at   timestamptz not null default now()
);
create index if not exists session_draws_by_session on session_draws (session_id);

create table if not exists favourites (
  user_id uuid not null references users(id) on delete cascade,
  item_id uuid not null,
  primary key (user_id, item_id)
);
alter table favourites enable row level security;
alter table favourites force row level security;
create policy favourites_self on favourites
  using (user_id = current_setting('app.current_user', true)::uuid)
  with check (user_id = current_setting('app.current_user', true)::uuid);

-- DOWN
-- drop policy favourites_self on favourites;
-- drop table favourites;
-- drop index session_draws_by_session;
-- drop table session_draws;
-- drop table sessions;
