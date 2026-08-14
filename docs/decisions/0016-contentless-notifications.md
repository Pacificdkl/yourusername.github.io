# 0016 — Contentless notifications (invariant #9 made real)

- Status: accepted
- Date: 2026-08-11

## Context

Non-negotiable #9: no content in notification previews — preferably no content
push notifications at all. Until now there was no notification surface, so
`09-no-content-in-notifications` was `it.todo`.

## Decision

Add `src/notifications` whose builder makes content leakage **structurally
impossible**: `buildNotification` accepts only a `NotificationType` and an
optional internal path. It never accepts item titles/descriptions/categories,
partner identity, or boundary data, and the user-visible preview (title + body)
comes from a **frozen allow-list** — there is nothing to interpolate content
into. `type`/`url` live in `data` (for in-app routing) and are not part of the
preview. A non-internal `url` is rejected so a destination can't smuggle content
into the preview.

`CONTENT_PUSH_ENABLED = false` records the posture: contentless nudges only.

`tests/invariants/09-no-content-in-notifications.test.ts` is now real: every
producible payload has allow-listed title/body, exposes only `{title, body,
data}` with `data ⊆ {type, url}`, contains none of a set of content/identity
probes, and non-internal urls throw.

## Consequences

All nine invariants now have real, passing tests — **200 passing, 0 todo**.
Actual delivery (web push / service worker) is out of scope here; when added it
must send only these contentless payloads. `lint`, `typecheck`, `test`, `build`
all green.
