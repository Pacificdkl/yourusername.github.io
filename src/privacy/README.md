# `privacy/` — export, true delete, PIN lock

Phase 7 — **implemented** (see docs/decisions/0012-phase-7-privacy.md):
- `pin.ts` — PIN hashing with PBKDF2-SHA256 (per-PIN salt, 200k iterations).
  Only the hash is stored (`users.pin_hash`); the raw PIN never is. Biometric
  unlock stays a device/platform concern (the passkey layer).
- `service.ts`:
  - `setPin` / `hasPin` / `verifyPin` — the app lock.
  - `exportData` — the caller's OWN data only: the three permitted verification
    fields (no identity data, #2), the caller's own boundary answers (never the
    partner's, #5), a pairing summary, and session history.
  - `deleteAccount` — TRUE delete: `store.deleteUser` hard-removes the user and
    all their data and unpairs them, cascading the shared sessions + draws.

Routes (gated): `GET /api/privacy/export`, `POST /api/privacy/delete`,
`GET`/`POST /api/privacy/pin`, `POST /api/privacy/pin/verify`. UI:
`src/ui/PrivacyPanel.tsx` + `/settings` (delete requires an explicit confirm).

Discreet identity (§7.7): `app/manifest.ts` gives the installable PWA a neutral
name ("Spin") and an abstract icon (`public/icons/icon.svg`) that reveal nothing
about its purpose.

Tests: `tests/privacy/` and `tests/ui/privacy-panel.test.tsx`.
