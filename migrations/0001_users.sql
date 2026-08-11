-- 0001_users.sql — Phase 1 (auth + verification gate).
-- Reversible: see the DOWN section at the bottom.
--
-- Non-negotiable #2: this table stores ONLY the verification boolean, an opaque
-- provider reference, and a timestamp. No image, document number, DOB, or
-- biometric column exists — the schema is part of the enforcement.

-- UP
create extension if not exists "pgcrypto";

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  age_verified  boolean     not null default false,
  provider_ref  text,                       -- opaque handle at the assurance provider
  verified_at   timestamptz,
  device_fp_hash text,                       -- hash only, never a raw fingerprint
  pin_hash      text                         -- hash only, never a raw PIN
);

-- Row-level security on from the start (CLAUDE.md §3, §5). Request handlers use
-- a per-request role bound to the authenticated user id via `app.current_user`.
alter table users enable row level security;
alter table users force row level security;

-- A user may read/update only their own row.
create policy users_self_select on users
  for select using (id = current_setting('app.current_user', true)::uuid);
create policy users_self_update on users
  for update using (id = current_setting('app.current_user', true)::uuid);

-- DOWN
-- drop policy users_self_update on users;
-- drop policy users_self_select on users;
-- drop table users;
