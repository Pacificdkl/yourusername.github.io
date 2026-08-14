# Data Protection Impact Assessment — Spin

- Status: **DRAFT for review** (Phase 8, CLAUDE.md §7.8)
- Date: 2026-08-11
- Owner: (assign a DPO / accountable person before launch)

> This DPIA is a **launch blocker**. It must be reviewed and signed off, and ICO
> registration completed, before processing real users' data. It is written
> against the code in this repository as of Phase 7; items marked **OPEN** must
> be closed first.

## 1. Why a DPIA is required

Spin processes information about users' **sex life / sexual orientation** — UK
GDPR **Article 9 special-category data** — and does so systematically for all
users. That triggers a mandatory DPIA (UK GDPR Art 35; ICO "likely high risk"
list: special-category data, matching/combining datasets, and services used by
the public at scale).

## 2. Nature, scope, context, purposes

- **What we process**
  - Account: an internal id, `age_verified` (boolean), an opaque
    `provider_ref`, `verified_at`, optional `device_fp_hash` / `pin_hash`
    (hashes only), and Article 9 consent (`consent_version`, `consent_granted_at`).
  - Special-category: per-item **boundary answers** (yes/maybe/no) and **session
    draws** (what was suggested) for a pairing.
  - Auth: passkey credentials (public keys + counters) and a hashed email index
    for the magic-link fallback.
- **What we deliberately do NOT process** (non-negotiable #2): no image,
  document number, DOB, or biometric template from age assurance — the provider
  returns only a boolean + opaque reference.
- **Purpose**: let two verified, paired adults receive a random suggestion drawn
  only from the intersection of what both consented to. Not advertising, not
  profiling, not recommendation.
- **Data subjects**: verified adults (18+) who pair with a partner.
- **Scale/context**: consumer PWA; both partners' data is combined to compute a
  shared pool (a "matching/combining" operation, hence higher scrutiny).

## 3. Lawful basis

- **Article 6(1)(a)** consent, **and Article 9(2)(a) EXPLICIT consent** for the
  special-category processing.
- Consent is implemented as a **separate, explicit opt-in, distinct from any
  T&Cs** (`src/consent`, `withConsent` gate). It is versioned, unbundled
  (requires `granted: true`), and **withdrawable** at any time; withdrawal
  immediately blocks special-category routes. See §7.8 requirement.
- Age assurance is provided by a **third party** (no identity data stored) to
  meet the Online Safety Act "highly effective age assurance" duty (see §9).

## 4. Necessity & proportionality

- **Data minimisation**: the users table has no identity columns; age assurance
  yields only a boolean + reference; only boundary answers and draws — the
  minimum needed to compute a shared pool — are special-category.
- **Purpose limitation**: no analytics, ad SDKs, session replay, or
  payload-capturing error reporters (non-negotiable #8), enforced by test
  `08-no-third-party` and the §9 CDN scan.
- **Storage limitation**: unilateral unpair deletes shared session history in
  the same transaction (non-negotiable #7); true delete hard-removes a user and
  cascades (Phase 7). Retention policy for still-paired users is **OPEN** (§8).

## 5. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation | Evidence |
|---|------|-----------|--------|------------|----------|
| R1 | A partner learns the other's private answers | Med | High | Boundary opacity — own-only reads, pool is ids-only, no per-side answer in any response/error (#5) | `05-boundary-opacity` |
| R2 | Content shown before age verification | Low | High | Server-side gate on every data route (middleware + `withVerified`), filesystem-enumerated test (#1) | `01-gate`, §9 [3] scan |
| R3 | Special-category processing without valid consent | Med | High | Explicit Article 9 consent gate, separate from T&Cs, withdrawable (§7.8) | `tests/consent` |
| R4 | Identity data leaks into storage/logs | Low | High | No identity columns; callback stores only 3 fields; log scrubbing test (#2) | `02-no-identity-data` |
| R5 | Predictable / biased suggestions | Low | Med | CSPRNG only, filter-before-draw, uniformity chi-square (#3, #6) | `03`, `06` |
| R6 | Data retained after a relationship ends | Med | Med | Unilateral unpair cascade delete (#7) | `07-unilateral-unpair` |
| R7 | Account/data not truly erasable | Low | High | True delete cascade; export for portability (Phase 7) | `tests/privacy` |
| R8 | Data at rest readable on DB compromise | Med | High | **OPEN** — at-rest / client-side encryption of `boundary_answers` & `session_draws` not yet implemented (ADR 0005) | — |
| R9 | Content in notification previews | Low | Med | **OPEN/By-design** — no notification surface exists; invariant #9 to be enforced when one is added | `09` (todo) |
| R10 | Data leaves UK/EU region | Low | High | **OPEN** — hosting/DB region must be pinned to EU/UK and verified (§3) | — |

## 6. Data subject rights

- **Access / portability**: `GET /api/privacy/export` returns the subject's own
  data as JSON (own answers only — never the partner's).
- **Erasure**: `POST /api/privacy/delete` hard-deletes and cascades.
- **Withdraw consent**: via the consent route / Settings; immediate effect.
- **Rectification**: boundary answers are editable at any time (instant effect).

## 7. International transfers

- Requirement: EU/UK hosting **and** DB region (CLAUDE.md §3). Currently **OPEN**
  — the app is not yet deployed; region must be pinned and verified, and any
  sub-processor (age-assurance provider, email sender, host) covered by an
  appropriate transfer mechanism and a DPA.

## 8. Consultation & sign-off

- [ ] DPO / accountable owner assigned
- [ ] ICO registration (data protection fee) completed
- [ ] Age-assurance provider DPA + "highly effective" assessment on file
- [ ] Retention schedule defined for still-active pairings
- [ ] R8 (encryption at rest) closed — **launch blocker**
- [ ] R10 (region) pinned and verified — **launch blocker**
- [ ] Consultation with data subjects/representatives considered

## 9. Online Safety Act — age assurance

Spin serves adult sexual content, so it must apply **"highly effective age
assurance" (HEAA)**. Third-party assurance is already mandated (§3) and no
identity data is retained. Before launch: confirm the chosen provider(s) meet
current Ofcom HEAA guidance, offer at least two methods, and record the basis of
that assessment. Re-check against the latest Ofcom codes at launch time.

## 10. Residual risk

With R1–R7 mitigated and tested, residual risk is **low** for those vectors. The
overall residual risk is **not yet acceptable for launch** because R8 (encryption
at rest) and R10 (region) are open, and the DPIA/ICO sign-off is outstanding.
Re-assess once §8's blockers are closed.
