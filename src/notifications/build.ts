/**
 * Notifications (CLAUDE.md non-negotiable #9): no content in notification
 * previews — preferably no content push notifications at all.
 *
 * The design makes leaking content STRUCTURALLY IMPOSSIBLE: `buildNotification`
 * accepts only a `NotificationType` (and an optional internal path to open). It
 * never accepts item titles/descriptions/categories, partner identity, or
 * boundary data, and its user-visible copy comes from a frozen allow-list — so
 * there is nothing to interpolate content into. The preview (title + body) is
 * always generic; the `type`/`url` in `data` is for in-app routing and is not
 * shown in the preview.
 *
 * `CONTENT_PUSH_ENABLED` is false: the app's posture is contentless nudges only.
 */

export type NotificationType = 'pairing_update' | 'session_update' | 'generic';

export interface NotificationPayload {
  title: string;
  body: string;
  data: { type: NotificationType; url?: string };
}

/** Posture: no content push notifications at all (#9). */
export const CONTENT_PUSH_ENABLED = false as const;

const TITLE = 'Spin';

/** Frozen, generic copy. Reveals nothing about content, partner, or activity. */
const BODY: Readonly<Record<NotificationType, string>> = Object.freeze({
  pairing_update: 'You have a new update.',
  session_update: 'You have a new update.',
  generic: 'You have a new update.',
});

export const ALLOWED_TITLES: readonly string[] = [TITLE];
export const ALLOWED_BODIES: readonly string[] = Object.freeze([...new Set(Object.values(BODY))]);

/** True for an in-app path with no scheme/host and no smuggled content. */
function isInternalPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

/**
 * Builds a contentless notification payload. Throws if given a non-internal
 * `url` (which could smuggle content into the preview via the destination).
 */
export function buildNotification(type: NotificationType, url?: string): NotificationPayload {
  if (url !== undefined && !isInternalPath(url)) {
    throw new Error('notification url must be an internal path');
  }
  const data: NotificationPayload['data'] = url === undefined ? { type } : { type, url };
  return { title: TITLE, body: BODY[type], data };
}

// Trigger helpers — the ONLY producers of notifications. They take no content,
// so nothing content-bearing can reach a payload.
export function notifyPairingUpdate(): NotificationPayload {
  return buildNotification('pairing_update', '/');
}
export function notifySessionUpdate(): NotificationPayload {
  return buildNotification('session_update', '/');
}
