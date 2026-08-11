# CLAUDE.md — "Spin"

Repo guide for Claude Code. Read this before writing any code. If a request conflicts with **Non-negotiables**, stop and flag it rather than implementing it.

---

## 1. What this is

A mobile-first, installable PWA for **verified adult partners**. Two paired accounts each set private boundaries; the app draws a uniformly random suggestion from the intersection of what both consented to.

Not a native app. Not a content site. Not a recommender.

---

## 2. Non-negotiables

These are invariants, not preferences. Every one needs a test.

1. **No content before verification.** Unverified sessions resolve to the verification screen only. Enforce server-side on every data route — not just in the router.
2. **No raw identity data, ever.** Persist `age_verified: boolean`, `provider_ref: string`, `verified_at: timestamp`. No image, document number, DOB, or biometric template touches our storage or logs.
3. **Filter before draw.** The random pick happens on an already-filtered array. Never draw then reject — that leaks excluded items through timing and through any logging.
4. **A single "No" is absolute.** No setting, admin flag, or partner action can return a hard-limited item to the pool.
5. **Boundary opacity.** Partner A's per-item answers are never readable by Partner B through any endpoint, response shape, or error message. The only shared read is the resulting pool.
6. **`crypto.getRandomValues()`.** `Math.random()` anywhere in `spin/` fails CI.
7. **Unilateral unpair.** Instant, no approval, no delay, no notification to the other party beyond the pairing simply being gone. Shared session history is deleted in the same transaction.
8. **Zero third-party analytics, ad SDKs, session replay, or error reporters that capture payloads.** If an error reporter is added, it must scrub bodies by default.
9. **No content in notification previews.** Preferably no content push notifications at all.

---

## 3. Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind, Framer Motion (wheel only)
- **Backend:** Next.js App Router API routes (or Node/Express if separated — pick once, record it here)
- **DB:** PostgreSQL + row-level security
- **Auth:** passkeys primary, email magic link fallback. No passwords.
- **Age assurance:** third-party only — Yoti, Persona, Veriff, or Stripe Identity. Offer at least two check methods.
- **Hosting:** EU/UK region. Verify the DB region too, not just the app.

Commands:
```
pnpm dev          # local
pnpm test         # vitest, must pass before any commit
pnpm test:invariants  # the non-negotiables suite
pnpm lint         # eslint + the custom no-math-random rule
pnpm db:migrate
```

---

## 4. Directory layout

```
src/
  auth/           # passkey + magic link, session
  verify/         # age-assurance provider adapter (one interface, two impls)
  pairing/        # invite codes, pair state, unpair
  boundaries/     # per-user item answers, pool computation
  spin/           # RNG + draw. No I/O, no DB imports. Pure.
  content/        # library schema, seed data, review status
  privacy/        # export, delete, PIN lock
  ui/
tests/
  invariants/     # the section 2 list, one file each
```

`spin/` stays pure and dependency-free so the randomness is trivially auditable. Pool computation lives in `boundaries/`, not `spin/`.

---

## 5. Data model sketch

```sql
users(id, created_at, age_verified, provider_ref, verified_at, device_fp_hash, pin_hash)
pairings(id, user_a, user_b, status, created_at)  -- one active per user
invite_codes(code, issuer, expires_at, consumed_at) -- 6 chars, 15 min, single use
content_items(id, title, category, description, intensity, difficulty,
              tags[], safety_notes, source, licence, reviewed_by, reviewed_at)
boundary_answers(user_id, item_id, answer)  -- yes | maybe | no
sessions(id, pairing_id, intensity_cap, no_repeat, started_at, ended_at)
session_draws(session_id, item_id, drawn_at)
favourites(user_id, item_id)
```

RLS: `boundary_answers` readable only by `user_id = current_user`. Never by partner, never by a service role used in request handlers. Encrypt `boundary_answers` and `session_draws` at rest; evaluate client-side encryption for both before shipping — if you choose server-readable, write the reason in `docs/decisions/`.

Pool rule: default **both-Yes only**. Optional toggle widens to include Yes+Maybe and Maybe+Maybe. Any `no` from either side removes the item unconditionally, at every setting.

---

## 6. Content

Do **not** scrape. Seed only from:
- Public-domain texts: Burton's 1883 *Kama Sutra*, *Ananga Ranga*, *The Perfumed Garden*. Modern translations (Doniger & Kakar 2002 and similar) are in copyright — excluded.
- Commissioned original prose and line art, or a licensed stock library.

Every record needs `source` + `licence` populated and `reviewed_by` set before it can ship. Add a migration guard: rows with `reviewed_at IS NULL` are never returned by the pool query in production.

Descriptions: clear, plain, non-graphic, non-clinical. Every BDSM item requires `safety_notes` covering circulation, nerve compression, aftercare, and never leaving a bound person alone — plus a link to an established safety resource. An item in that category with empty `safety_notes` is a failed insert, enforced by a DB constraint.

---

## 7. Build order

Work one phase at a time. Each phase ends with tests green and a short note in `docs/decisions/`.

1. **Auth + verification gate** — passkeys, session, provider adapter, hard gate. Prove the gate server-side with a test that calls every data route unauthenticated and unverified.
2. **Pairing** — invite code generation, expiry, single use, dual confirmation, unilateral unpair with cascade delete.
3. **Boundaries** — three-state answers, pool computation, opacity tests, instant effect on edit.
4. **Content schema + seed** — schema, constraints, review workflow, initial public-domain seed set.
5. **Spin engine** — pure module, CSPRNG, uniformity test over ~1e6 draws (chi-square), no-repeat as pool removal.
6. **UI + session flow** — wheel, result card, category selector, intensity cap slider, always-visible safeword and one-tap stop.
7. **Privacy controls** — export, true delete, PIN/biometric lock, discreet icon and app name.
8. **Security review + DPIA** — sexual-life data is UK GDPR Article 9 special category. Separate explicit opt-in, distinct from T&Cs. Complete the DPIA and ICO registration before launch. Check current Online Safety Act "highly effective age assurance" duties.

---

## 8. Kickoff prompt

Paste this into Claude Code at the repo root:

> Read CLAUDE.md. We are on **Phase 1 only** — auth and the age-verification gate. Scaffold the Next.js + TypeScript + Tailwind project, set up Postgres with the users table and RLS enabled, implement passkey auth with magic-link fallback, and build a `VerificationProvider` interface with a stub implementation plus a real adapter for one provider. Add the server-side gate as middleware AND as a per-route check. Write `tests/invariants/01-gate.test.ts` proving that every data route returns 403 for unverified sessions, and `02-no-identity-data.test.ts` proving the verification callback persists only the boolean, provider ref, and timestamp. Stop when Phase 1 tests pass. Do not start Phase 2.

Then per phase:

> Phase N complete and green. Move to Phase N+1 per CLAUDE.md section 7. Re-read the non-negotiables first, list which ones this phase touches, and write those tests before the implementation.

---

## 9. Review checklist before any merge

- [ ] No `Math.random()` outside test fixtures
- [ ] No identity payload in any log, trace, or error body
- [ ] Every new endpoint checks verification and pairing server-side
- [ ] No new third-party script, SDK, or font CDN
- [ ] Partner-boundary opacity holds for the new response shapes
- [ ] Migration is reversible and doesn't widen RLS
