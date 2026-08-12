# 0015 — PostgreSQL schema + RLS + adapter

- Status: accepted — schema, RLS, and the full PgStore binding are implemented
  and tested. Only the production `pg.Pool` wiring + connection-role setup
  remain (thin, documented). Updated 2026-08-11.
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

## The PgStore binding — implemented

`src/db/pg-store.ts` implements the full `Store` (all 40 methods) over a minimal
`Db` interface. `tests/db/pg-store.test.ts` exercises every method against
pglite (real Postgres) — users/verification/consent/pin, passkey credentials +
challenges, magic tokens + email index, invites/pairings/sessions/draws,
encrypted boundary answers, content constraints + review guard, and the
`unpairUser` / `deleteUser` cascades. Both subtleties are handled:

- **Per-request RLS context.** RLS-scoped operations (`boundary_answers`) run
  through `scoped(userId, …)`, a transaction that does
  `SET LOCAL app.current_user = $1`, so the GUC can't be lost across pooled
  connections.
- **Transactional cascades.** `unpairUser` and `deleteUser` run in a single
  transaction; FK `ON DELETE CASCADE` removes the dependent rows (sessions +
  draws with a pairing; credentials/tokens/answers with a user).

Field encryption at rest (ADR 0005) is applied in the adapter exactly as in the
in-memory store, verified by asserting the raw `answer` column is ciphertext.

The `boundaries/` and `spin/` logic is unaffected — the store is an interface,
so the binding drops in behind it.

### Remaining (thin): production `pg.Pool` wiring

Add the `pg` dependency and the ~20-line `pgPoolToDb(pool)` adapter (sketched at
the bottom of `pg-store.ts`), select `PgStore` by `DATABASE_URL`, and connect as
a non-`BYPASSRLS` application role. The in-memory store must not run in
production.

## Consequences

`lint`, `typecheck`, `test` (189 passing, 3 todo), `build` all green. The DB
controls are proven; the security review's High item is downgraded to "schema +
RLS proven; adapter binding remaining". pglite is a dev/test dependency only.
