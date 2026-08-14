-- 0003_pairing.sql — Phase 2 (pairing). Reversible: see DOWN.

-- UP
create table if not exists invite_codes (
  code        text primary key,               -- 6 chars, single use
  issuer      uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,           -- 15 min from issue
  consumed_at timestamptz
);

create table if not exists pairings (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references users(id) on delete cascade,
  user_b      uuid not null references users(id) on delete cascade,
  status      text not null check (status in ('pending','active','ended')),
  created_at  timestamptz not null default now(),
  confirmed_a boolean not null default false,
  confirmed_b boolean not null default false
);

-- One non-ended pairing per user, enforced at the database level for both sides.
create unique index if not exists one_active_pairing_a
  on pairings (user_a) where status <> 'ended';
create unique index if not exists one_active_pairing_b
  on pairings (user_b) where status <> 'ended';

-- DOWN
-- drop index one_active_pairing_b;
-- drop index one_active_pairing_a;
-- drop table pairings;
-- drop table invite_codes;
