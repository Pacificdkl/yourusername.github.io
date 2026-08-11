# `privacy/` — export, true delete, PIN/biometric lock

Phase 7 responsibilities:
- Data export (user's own data only).
- **True delete** — actual removal, not soft-flag.
- PIN / biometric app lock; PIN stored only as `pin_hash`.
- Discreet app icon and name.

Cross-cutting invariants this module must not break: **#2** (no identity data),
**#5** (boundary opacity — an export gives a user their *own* answers, never the
partner's), **#8** (no third-party analytics/reporters), **#9** (no content in
notification previews).
