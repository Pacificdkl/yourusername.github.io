/**
 * Passkey (WebAuthn) authentication — the primary method (CLAUDE.md §3).
 * No passwords anywhere. Uses @simplewebauthn/server for all cryptographic
 * verification (we never hand-roll it).
 *
 * Registration and authentication each have two steps:
 *   1. options — server issues a challenge, stored server-side.
 *   2. verify  — server verifies the authenticator's signed response.
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { store } from '@/db';
import type { StoredCredential } from '@/db';

const CHALLENGE_TTL_MS = 1000 * 60 * 5; // 5 minutes

function rpID(): string {
  return process.env.WEBAUTHN_RP_ID ?? 'localhost';
}
function rpName(): string {
  return process.env.WEBAUTHN_RP_NAME ?? 'Spin';
}
function origin(): string {
  return process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';
}

function userIdToBytes(userId: string): Uint8Array<ArrayBuffer> {
  // Allocate an ArrayBuffer-backed view (the library's Uint8Array_ type).
  const src = new TextEncoder().encode(userId);
  const out = new Uint8Array(src.byteLength);
  out.set(src);
  return out;
}

/** Step 1 of registration: issue creation options and stash the challenge. */
export async function startRegistration(userId: string) {
  const existing = await store.getCredentials(userId);
  const options = await generateRegistrationOptions({
    rpName: rpName(),
    rpID: rpID(),
    userName: userId, // opaque; not an email/identity
    userID: userIdToBytes(userId),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: c.transports as never,
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });

  await store.putChallenge({
    userId,
    challenge: options.challenge,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return options;
}

/** Step 2 of registration: verify the authenticator response and store the credential. */
export async function finishRegistration(
  userId: string,
  response: RegistrationResponseJSON,
): Promise<{ verified: boolean }> {
  const pending = await store.takeChallenge(userId);
  if (!pending) return { verified: false };

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
  });

  if (!verification.verified || !verification.registrationInfo) return { verified: false };

  const { credential } = verification.registrationInfo;
  const stored: StoredCredential = {
    id: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    ...(credential.transports ? { transports: credential.transports as string[] } : {}),
  };
  await store.addCredential(userId, stored);
  return { verified: true };
}

/** Step 1 of authentication: issue request options and stash the challenge. */
export async function startAuthentication(userId: string) {
  const creds = await store.getCredentials(userId);
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports as never })),
    userVerification: 'preferred',
  });
  await store.putChallenge({
    userId,
    challenge: options.challenge,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return options;
}

/** Step 2 of authentication: verify the assertion and bump the signature counter. */
export async function finishAuthentication(
  userId: string,
  response: AuthenticationResponseJSON,
): Promise<{ verified: boolean }> {
  const pending = await store.takeChallenge(userId);
  if (!pending) return { verified: false };

  const found = await store.findCredentialById(response.id);
  if (!found || found.userId !== userId) return { verified: false };

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
    credential: {
      id: found.cred.id,
      publicKey: found.cred.publicKey as Uint8Array<ArrayBuffer>,
      counter: found.cred.counter,
      transports: found.cred.transports as never,
    },
  });

  if (!verification.verified) return { verified: false };
  await store.updateCredentialCounter(found.cred.id, verification.authenticationInfo.newCounter);
  return { verified: true };
}
