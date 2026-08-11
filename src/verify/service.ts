/**
 * Verification service — the composition root that selects a provider and the
 * one place a verification result is persisted.
 *
 * Non-negotiable #2 lives here: `verifyAndPersist` takes the provider's minimal
 * result and writes ONLY age_verified/provider_ref/verified_at via
 * `store.markVerified`. Nothing else about the provider payload is read,
 * returned, or logged.
 */

import { store } from '@/db';
import { StubVerificationProvider } from './stub-provider';
import { PersonaVerificationProvider } from './persona-provider';
import type { VerificationProvider, VerificationResult } from './provider';

/** Selects the configured provider. Refuses the stub in production. */
export function getProvider(): VerificationProvider {
  const id = process.env.VERIFY_PROVIDER ?? 'stub';
  if (id === 'stub') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Stub verification provider must not run in production.');
    }
    return new StubVerificationProvider();
  }
  if (id === 'persona') {
    return new PersonaVerificationProvider(
      process.env.VERIFY_PROVIDER_API_KEY ?? '',
      process.env.VERIFY_PROVIDER_WEBHOOK_SECRET ?? '',
    );
  }
  throw new Error(`Unknown VERIFY_PROVIDER: ${id}`);
}

/**
 * Runs a provider callback for a user and persists the minimal result. Returns
 * the boolean outcome only — never the provider payload.
 */
export async function verifyAndPersist(
  userId: string,
  rawBody: unknown,
  signature: string | null,
): Promise<{ ageVerified: boolean }> {
  const provider = getProvider();
  const result: VerificationResult = await provider.handleCallback(rawBody, signature);

  if (result.ageVerified) {
    await store.markVerified(userId, {
      providerRef: result.providerRef,
      verifiedAt: result.verifiedAt,
    });
  }
  return { ageVerified: result.ageVerified };
}
