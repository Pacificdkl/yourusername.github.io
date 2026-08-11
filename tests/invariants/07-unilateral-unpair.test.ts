/**
 * Non-negotiable #7 — Unilateral unpair.
 *
 * Instant, no approval, no delay, no notification to the other party beyond the
 * pairing simply being gone. Shared session history is deleted in the SAME
 * transaction.
 *
 * Phase 2 implements pairing; these todos become real DB-transaction tests.
 */
import { describe, it } from 'vitest';

describe('invariant #7: unilateral unpair', () => {
  it.todo('either partner can unpair without the other\'s approval');
  it.todo('unpair takes effect immediately (no delay/grace window)');
  it.todo('unpair deletes sessions + session_draws in the same transaction');
  it.todo('the other party receives no content notification — only absence of the pairing');
});
