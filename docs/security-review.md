# Security review — Spin (Phase 8)

- Status: **DRAFT for review** (CLAUDE.md §7.8)
- Date: 2026-08-11
- Scope: the code in this repository as of Phase 7 + the Article 9 consent gate.

## 1. Assets & threat model

**Assets (most sensitive first):** users' boundary answers and session draws
(Article 9), the pairing graph, auth credentials/sessions, verification status.

**Adversaries:**
- A **paired partner** trying to read the other's private answers.
- An **unverified / unconsented** user trying to reach content.
- A **network attacker** (session forgery, replay).
- A **DB-read attacker** (stolen backup / compromised role).
- A **malicious/naive client** sending crafted payloads.

## 2. Findings against the non-negotiables

| # | Control | Status | Evidence |
|---|---------|--------|----------|
| 1 | No content before verification — server-side, every route | **PASS** | `middleware.ts` + `withVerified`/`withConsent`; `01-gate` enumerates routes; §9 [3] scan |
| 2 | No raw identity data in storage or logs | **PASS** | no identity columns; `02-no-identity-data` |
| 3 | Filter before draw | **PASS** | `spin/draw` takes no predicate; session filters then draws; `03`, `tests/session` |
| 4 | A single "No" is absolute | **PASS** | `computePool` checks `no` first at every mode; `04` |
| 5 | Boundary opacity | **PASS** | own-only reads, ids-only pool, no reason strings; `05` |
| 6 | CSPRNG only | **PASS** | `crypto.getRandomValues`; ESLint rule + `06` + §9 [1] scan |
| 7 | Unilateral unpair + cascade | **PASS** | `unpairUser` single-transaction; `07` |
| 8 | No third-party analytics/SDK/CDN | **PASS** | `08` denylist + §9 [4] scan |
| 9 | No content in notification previews | **N/A (todo)** | no notification surface exists; `09` todo |

## 3. Control review by area

- **AuthN/session**: passkeys (WebAuthn via `@simplewebauthn/server`) + magic
  link; no passwords. Sessions are HMAC-SHA256 signed (Web Crypto), `HttpOnly`,
  `SameSite=Lax`, `Secure` in prod, with an expiry; signature compared in
  constant time. The session asserts identity only — `ageVerified`/consent are
  re-read from the store each request, so a cookie can't forge them.
- **AuthZ**: `withVerified` (verification) and `withConsent` (verification +
  Article 9 consent) wrap every data route; pairing-scoped operations require an
  active pairing in the service layer.
- **Consent**: explicit, versioned, unbundled, withdrawable; withdrawal blocks
  immediately (`tests/consent`).
- **Input handling**: JSON parsing is guarded (`.catch(() => ({}))`); answers,
  categories, modes, and PINs are validated against allow-lists/patterns.
- **Randomness**: rejection-sampled `randomInt` (no modulo bias); the wheel's
  cosmetic spin also uses the CSPRNG, never `Math.random`.
- **Secrets**: `SESSION_SECRET` required in production (throws otherwise); PINs
  stored as PBKDF2 hashes; email stored only as a hash.
- **Headers**: `X-Content-Type-Options`, `Referrer-Policy: no-referrer`,
  `X-Frame-Options: DENY`, `poweredByHeader: false`.

## 4. Weaknesses / recommendations

| Sev | Item | Recommendation |
|-----|------|----------------|
| High | **Encryption at rest** for `boundary_answers` / `session_draws` not implemented (ADR 0005) | Decide client-side vs server-side encryption and implement before launch (DPIA R8) |
| High | **PostgreSQL adapter + RLS not wired** | The store is in-memory; production needs the pg adapter with the RLS policies actually enforced (per-request `app.current_user`), plus real transactions for unpair/delete |
| Med | **No CSRF token** on state-changing POSTs | `SameSite=Lax` mitigates cross-site form posts; add a CSRF token or origin check before launch, especially for `POST` mutations |
| Med | **No rate limiting** on auth, magic-link, invite redeem, PIN verify | Add throttling/lockout to resist brute force (invite codes, PIN, magic tokens) |
| Med | **Provider webhook signature** verification is a TODO in `PersonaVerificationProvider` | Implement HMAC verification before enabling a real provider |
| Med | **CSP** not set | Add a strict Content-Security-Policy (no external origins — consistent with #8) |
| Low | **Region** not pinned | Pin EU/UK app + DB region and verify (DPIA R10) |
| Low | **Security headers** could add HSTS at the edge/host | Enable HSTS in production |

## 5. §9 merge checklist

Automated as `tests/review/checklist.test.ts` + CI (`lint → typecheck → test →
build`). Items 1/3/4/6 are enforced statically; 2/5 are pinned to `02`/`05`. See
`docs/review-checklist.md`.

## 6. Conclusion

The nine product invariants are implemented and tested; the auth/authz/consent
model is sound. **Not launch-ready** until the High items (encryption at rest,
pg + RLS) and the DPIA blockers (region, ICO sign-off) are closed, and the Med
items (CSRF, rate limiting, provider webhook, CSP) are addressed. Recommend a
follow-up review after the pg adapter lands, since RLS is a primary control for
finding #5 in production.
