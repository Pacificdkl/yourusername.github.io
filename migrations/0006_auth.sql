-- 0006_auth.sql — Phase 1 auth backing tables (passkeys, magic link, challenges).
-- These were previously only in the in-memory store; the pg adapter needs them.
-- Reversible: see DOWN.

-- UP
create table if not exists webauthn_credentials (
  id         text primary key,                -- base64url credential id
  user_id    uuid not null references users(id) on delete cascade,
  public_key bytea not null,
  counter    bigint not null default 0,
  transports text[]
);
create index if not exists webauthn_credentials_by_user on webauthn_credentials (user_id);

-- One pending challenge per user (mirrors the in-memory keying).
create table if not exists webauthn_challenges (
  user_id    uuid primary key references users(id) on delete cascade,
  challenge  text not null,
  expires_at timestamptz not null
);

create table if not exists magic_tokens (
  token_hash  text primary key,               -- SHA-256 of the raw token
  user_id     uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  consumed_at timestamptz
);

-- Pseudonymous email index for the magic-link fallback: a HASH only, never the
-- raw address (keeps the users table identity-free, §5).
create table if not exists email_identities (
  email_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade
);

-- DOWN
-- drop table email_identities;
-- drop table magic_tokens;
-- drop table webauthn_challenges;
-- drop index webauthn_credentials_by_user;
-- drop table webauthn_credentials;
