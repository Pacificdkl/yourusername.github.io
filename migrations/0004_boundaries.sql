-- 0004_boundaries.sql — Phase 3 (boundaries). Reversible: see DOWN.
--
-- This is the primary boundary-opacity control (invariant #5) at the database
-- level: RLS restricts every row of boundary_answers to its owner, so a partner
-- or a service role used in a request handler can never read another user's
-- answers — even a query with no WHERE clause returns only the caller's rows.

-- UP
create table if not exists boundary_answers (
  user_id uuid not null references users(id) on delete cascade,
  item_id uuid not null,
  -- Ciphertext at rest (§5, ADR 0005): AES-GCM token, NOT the plain enum, so no
  -- CHECK on the value here — the app validates yes|maybe|no before encrypting.
  answer  text not null,
  primary key (user_id, item_id)
);

alter table boundary_answers enable row level security;
-- FORCE so the policy applies even to the table owner (defence in depth).
alter table boundary_answers force row level security;

-- Readable/writable ONLY by the current user (CLAUDE.md §5). Never by a partner,
-- never by a service role in a request handler.
create policy boundary_answers_self on boundary_answers
  using (user_id = current_setting('app.current_user', true)::uuid)
  with check (user_id = current_setting('app.current_user', true)::uuid);

-- DOWN
-- drop policy boundary_answers_self on boundary_answers;
-- drop table boundary_answers;
