# 0005 — Encryption of boundary_answers and session_draws

- Status: **accepted** — server-side encryption at rest (option 2); client-side
  E2E deferred with a documented reason. Updated 2026-08-11 (was OPEN).
- Date: 2026-08-11

## Context

CLAUDE.md §5: "Encrypt `boundary_answers` and `session_draws` at rest; evaluate
client-side encryption for both before shipping — if you choose server-readable,
write the reason in `docs/decisions/`." This is UK GDPR Article 9 special-
category data (sexual life), so the bar is high (CLAUDE.md §7.8).

## Options

1. **Client-side (end-to-end) encryption.** Answers encrypted on-device; the
   server stores ciphertext and computes the pool without plaintext. Strongest
   privacy; hardest to build (pool intersection over encrypted data, key
   management across two paired devices, recovery).
2. **Server-side encryption at rest, server-readable.** Column/disk encryption;
   the app decrypts to compute the pool. Simpler; server can read plaintext, so
   compromise or a misused service role could expose answers.

## Decision

**Option 2 — server-side encryption at rest**, implemented as AES-256-GCM
field encryption (`src/crypto/field.ts`) applied at the store boundary to
`boundary_answers.answer` and `session_draws.item_id`. Values are ciphertext at
rest and decrypted only when the application reads them.

### Why server-side (not client-side E2E) for now

- The core feature is **pool intersection across two partners' answers**. Doing
  that over end-to-end-encrypted data requires either a shared pairing key
  negotiated between two devices or searchable/deterministic encryption, plus
  key backup/recovery when a device is lost. That is a substantial build and a
  usability/recovery risk.
- Server-side encryption still materially raises the bar: a stolen database
  backup or a leaked disk yields ciphertext, not preferences. Combined with RLS
  (partner/service-role cannot read another user's rows) it covers the primary
  threats (backup theft, misused service role reading columns) short of a live
  application-memory compromise.

### Mitigations / production requirements

- Key custody: `DATA_ENCRYPTION_KEY` must be a KMS-wrapped 32-byte key in
  production (envelope encryption), not a plain env var; rotate on leak.
- RLS forbids partner/service-role reads of `boundary_answers` (enforced by the
  pg adapter, ADR 0015).
- Residual: the running app can read plaintext (needed to compute the pool). A
  future move to client-side E2E remains open and is recorded as a stretch goal.

### Residual metadata

Key columns (`user_id`, `item_id`) stay plaintext so answers can be matched
between partners and indexed. That leaks *which* items a user has answered (not
the answer) to a DB-read attacker; this is mitigated by RLS and accepted for
now. Fully hiding it needs deterministic/searchable encryption — deferred.

## Consequences

Closed. `src/crypto/field.ts` + tests (`tests/crypto/field.test.ts`) implement
and prove the at-rest encryption; the `boundaries/` pure logic is unchanged
(`computePool` still takes decrypted answers). Production still needs KMS key
custody.
