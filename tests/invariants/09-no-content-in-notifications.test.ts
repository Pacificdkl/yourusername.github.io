/**
 * Non-negotiable #9 — No content in notification previews.
 *
 * Every notification the system can produce carries a generic, allow-listed
 * preview (title + body) and no content: no item title/description/category/
 * tags, no partner identity, no boundary answer. The builder accepts only a
 * type (+ internal url), so this holds by construction — these tests pin it.
 */
import { describe, it, expect } from 'vitest';
import {
  buildNotification,
  notifyPairingUpdate,
  notifySessionUpdate,
  CONTENT_PUSH_ENABLED,
  ALLOWED_TITLES,
  ALLOWED_BODIES,
  type NotificationType,
  type NotificationPayload,
} from '@/notifications';

const TYPES: NotificationType[] = ['pairing_update', 'session_update', 'generic'];

// Things that must NEVER appear in a notification preview.
const FORBIDDEN = [
  'Wrist restraint', // item title
  'A plain description.', // item description
  'bdsm', // category
  'restraint', // tag
  'yes', 'maybe', 'no', // boundary answers
  'partner', // partner-identifying language
];

function everyPayload(): NotificationPayload[] {
  return [...TYPES.map((t) => buildNotification(t)), notifyPairingUpdate(), notifySessionUpdate()];
}

describe('invariant #9: no content in notification previews', () => {
  it('payloads contain no item title/description/category/tags and no answers', () => {
    for (const p of everyPayload()) {
      const haystack = `${p.title}\n${p.body}`.toLowerCase();
      for (const term of FORBIDDEN) {
        expect(haystack).not.toContain(term.toLowerCase());
      }
    }
  });

  it('preview text is drawn only from the frozen allow-list (no interpolation)', () => {
    for (const p of everyPayload()) {
      expect(ALLOWED_TITLES).toContain(p.title);
      expect(ALLOWED_BODIES).toContain(p.body);
    }
  });

  it('payload shape exposes no content fields', () => {
    for (const p of everyPayload()) {
      expect(Object.keys(p).sort()).toEqual(['body', 'data', 'title']);
      // data carries only routing info — a type and, optionally, an internal path.
      expect(Object.keys(p.data).every((k) => k === 'type' || k === 'url')).toBe(true);
      if (p.data.url !== undefined) {
        expect(p.data.url.startsWith('/')).toBe(true);
        expect(p.data.url.startsWith('//')).toBe(false);
      }
    }
  });

  it('the default posture is: no content push notifications at all', () => {
    expect(CONTENT_PUSH_ENABLED).toBe(false);
  });

  it('a non-internal url (which could smuggle content) is rejected', () => {
    expect(() => buildNotification('generic', 'https://evil.example/Wrist-restraint')).toThrow();
    expect(() => buildNotification('generic', '//evil.example')).toThrow();
  });
});
