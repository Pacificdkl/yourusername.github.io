/**
 * Magic-link fallback (CLAUDE.md §3). No passwords. A raw token is emailed as a
 * one-time login link; only its SHA-256 hash is stored, so a store leak does not
 * yield usable links.
 *
 * Email handling and identity: the users table stays identity-free (CLAUDE.md
 * §5). We resolve an email to a user through a HASH of the address only. The
 * raw address is used to send the link and then dropped — never persisted. See
 * docs/decisions/0006-phase-1-auth-gate.md.
 */

import { store } from '@/db';

const TOKEN_TTL_MS = 1000 * 60 * 15; // 15 minutes
const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Normalise then hash an email for the pseudonymous lookup index. */
export async function emailHash(email: string): Promise<string> {
  return sha256Hex(email.trim().toLowerCase());
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes); // invariant #6
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface IssuedMagicLink {
  /** The raw token to embed in the emailed URL. Never stored. */
  token: string;
  userId: string;
}

/**
 * Issues a magic-link token for an email, creating a user + email link on first
 * sight. Returns the raw token for the caller to email; the caller must not log
 * it (invariant #2 spirit — treat it like a credential).
 */
export async function issueMagicLink(email: string): Promise<IssuedMagicLink> {
  const eh = await emailHash(email);
  let userId = await store.findUserIdByEmailHash(eh);
  if (!userId) {
    const user = await store.createUser();
    userId = user.id;
    await store.linkEmailHash(eh, userId);
  }

  const token = randomToken();
  await store.putMagicToken({
    tokenHash: await sha256Hex(token),
    userId,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    consumedAt: null,
  });
  return { token, userId };
}

/**
 * Consumes a raw magic-link token. Returns the userId on success, or null if the
 * token is unknown, expired, or already used (single-use).
 */
export async function consumeMagicLink(token: string): Promise<string | null> {
  const record = await store.consumeMagicToken(await sha256Hex(token), new Date());
  return record ? record.userId : null;
}
