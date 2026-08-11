# 0005 — Encryption of boundary_answers and session_draws

- Status: OPEN (decision required before Phase 3 ships)
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

**Not yet made.** Placeholder recorded now so the requirement is not lost. Phase
3 must resolve it. If option 2 is chosen, the justification goes here, along
with the mitigations (RLS forbidding partner/service-role reads, key custody,
audit).

## Consequences

Blocks Phase 3 sign-off until closed. The `boundaries/` pure logic is written to
be agnostic: `computePool` takes decrypted answers and returns ids only, so
either option can wrap it.
