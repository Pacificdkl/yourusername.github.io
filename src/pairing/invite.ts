/**
 * Invite codes (CLAUDE.md §5): 6 chars, 15-minute expiry, single use. Codes are
 * drawn with `crypto.getRandomValues()` via the spin RNG (non-negotiable #6).
 */

import { randomInt } from '@/spin/rng';
import { store } from '@/db';

export const INVITE_CODE_LENGTH = 6;
export const INVITE_TTL_MS = 15 * 60 * 1000;

/**
 * Crockford-style alphabet with ambiguous characters removed (no 0/O/1/I/L) so
 * codes are easy to read aloud and type.
 */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    out += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return out;
}

/** Generates a code not currently present in the store (retry on collision). */
export async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    if (!(await store.getInvite(code))) return code;
  }
  // Astronomically unlikely with a 31^6 space; fail loudly rather than loop.
  throw new Error('invite code generation: exhausted attempts');
}
