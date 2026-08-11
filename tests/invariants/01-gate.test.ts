/**
 * Non-negotiable #1 — No content before verification.
 *
 * Unverified sessions resolve to the verification screen only. The gate is
 * enforced server-side on EVERY data route (middleware AND per-route), not
 * just in the router.
 *
 * Phase 1 must replace these todos with a test that enumerates every data
 * route and asserts a 403 for (a) unauthenticated and (b) authenticated-but-
 * unverified sessions. Enumerate routes from the filesystem so a new route
 * cannot silently skip the gate.
 */
import { describe, it } from 'vitest';

describe('invariant #1: verification gate', () => {
  it.todo('returns 403 on every data route for an unauthenticated session');
  it.todo('returns 403 on every data route for an unverified (but authed) session');
  it.todo('unverified session can reach ONLY the verification screen');
  it.todo('gate is enforced per-route, not only in middleware');
});
