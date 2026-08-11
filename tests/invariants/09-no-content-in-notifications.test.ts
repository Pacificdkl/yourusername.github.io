/**
 * Non-negotiable #9 — No content in notification previews.
 *
 * Preferably no content push notifications at all. Any notification payload
 * must be contentless (no item title, description, category, or partner data).
 *
 * Phase 6/7 wires notifications (if any); these todos become real tests over
 * the notification builder's output.
 */
import { describe, it } from 'vitest';

describe('invariant #9: no content in notification previews', () => {
  it.todo('notification payloads contain no item title/description/category');
  it.todo('notification payloads contain no partner-identifying content');
  it.todo('default posture is: no content push notifications at all');
});
