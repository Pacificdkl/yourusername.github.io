/**
 * Explicit Article 9 consent (CLAUDE.md §7.8).
 *
 * Processing sexual-life data under UK GDPR needs the data subject's EXPLICIT
 * consent (Art 9(2)(a)) — freely given, specific, informed, unambiguous, and
 * SEPARATE from the T&Cs. This module records and checks that consent. It is a
 * distinct gate from age verification: a user can be verified but not yet have
 * given (or have withdrawn) Article 9 consent.
 */

import { store } from '@/db';

/**
 * The current consent-text version. Bump this whenever the consent wording
 * materially changes; users on an older version must re-consent (their prior
 * consent no longer counts as informed for the new terms).
 */
export const CONSENT_VERSION = '2026-08-11.v1';

export interface ConsentStatus {
  granted: boolean;
  /** The version the user agreed to (may be older than CONSENT_VERSION). */
  version: string | null;
  grantedAt: Date | null;
  /** The version the app currently requires. */
  currentVersion: string;
}

export async function grantConsent(userId: string): Promise<void> {
  await store.setConsent(userId, CONSENT_VERSION, new Date());
}

/** Withdrawal is immediate and blocks further special-category processing. */
export async function withdrawConsent(userId: string): Promise<void> {
  await store.withdrawConsent(userId);
}

export async function getConsent(userId: string): Promise<ConsentStatus> {
  const user = await store.findUser(userId);
  const version = user?.consentVersion ?? null;
  return {
    granted: version === CONSENT_VERSION,
    version,
    grantedAt: user?.consentGrantedAt ?? null,
    currentVersion: CONSENT_VERSION,
  };
}

/** True only if the user has consented to the CURRENT version. */
export async function hasConsent(userId: string): Promise<boolean> {
  const user = await store.findUser(userId);
  return user?.consentVersion === CONSENT_VERSION;
}
