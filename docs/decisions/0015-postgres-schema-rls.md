# 0015 — PostgreSQL schema + RLS (proven), adapter binding scoped

- Status: accepted (schema + RLS); PgStore binding OPEN (scoped below)
- Date: 2026-08-11

## Context

The security review flagged "PostgreSQL adapter + RLS not wired" as High: the
runtime store is in-memory, so several controls (boundary opacity, one-pairing-
per-user, cascade deletes) are only approximated. The primary control is **RLS
enforcing boundary opacity (#5)** — a partner or a service role in a request
handler must not be able to read another user's `boundary_answers`.

## Decisions

1. **Complete the schema as migrations** for every table:
   `0001_users` (+ consent columns), `0002_content`, `0003_pairing`,
   `0004_boundaries`, `0005_sessions`. Each is reversible (`-- DOWN`) and passes
   the §9 checklist. `boundary_answers.answer` and `session_draws.item_id` are
   `text` (they hold AES-GCM ciphertext at rest, ADR 0005), so no enum CHECK /
   uuid FK on those columns.

2. **Prove the DB controls against real Postgres.** `tests/db/pg-schema.test.ts`
   runs the migrations in **pglite** (in-process Postgres) and asserts:
   - the BDSM `safety_notes` CHECK rejects a bad insert;
   - `shippable_content` excludes unreviewed rows;
   - **RLS on `boundary_answers`**: as a non-owner role with `app.current_user`
     set, a `SELECT` with no `WHERE` returns only the current user's rows, and
     `WITH CHECK` blocks inserting a row for another user.

   This validates the actual production control (#5) end to end, not an
   in-memory analogue. RLS is tested as a non-superuser role because superusers
   bypass RLS.

3. **`one_active_pairing` is enforced by partial unique indexes**, closing the
   race the application check alone couldn't (ADR 0007 open item).

## OPEN — the PgStore binding (next production step, now de-risked)

Wiring each `Store` method to SQL is remaining. It is mechanical but has two
real subtleties that must be done correctly, so it is scoped rather than rushed:

- **Per-request RLS context under pooling.** RLS-scoped operations
  (`boundary_answers`, `favourites`, `users`) must run on a dedicated pooled
  client inside a transaction that does `SET LOCAL app.current_user = $1` and
  runs as a non-`BYPASSRLS` application role. A bare `pool.query` can land on a
  different connection and lose the GUC.
- **Transactions for `unpairUser` / `deleteUser`.** These must be a single SQL
  transaction; the FK `ON DELETE CASCADE` in the migrations does most of the
  work (deleting a pairing removes its sessions + draws; deleting a user
  cascades), but the method boundaries must still be transactional.

The `boundaries/` and `spin/` logic is unaffected — the store is an interface,
so the binding drops in behind it.

## Consequences

`lint`, `typecheck`, `test` (189 passing, 3 todo), `build` all green. The DB
controls are proven; the security review's High item is downgraded to "schema +
RLS proven; adapter binding remaining". pglite is a dev/test dependency only.
