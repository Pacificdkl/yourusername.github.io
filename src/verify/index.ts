/**
 * Verification composition root.
 *
 * TODO(phase-1): select the provider from VERIFY_PROVIDER env, refusing to
 * instantiate the stub when NODE_ENV === 'production'. Offer >= 2 methods.
 */
export type {
  VerificationProvider,
  VerificationResult,
  VerificationSession,
} from './provider';
export { StubVerificationProvider } from './stub-provider';
export { PersonaVerificationProvider } from './persona-provider';
export { getProvider, verifyAndPersist } from './service';
