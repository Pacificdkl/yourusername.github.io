export {
  signSession,
  verifySession,
  getSession,
  sessionCookieHeader,
  clearSessionCookieHeader,
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from './session';
export {
  withVerified,
  withSession,
  getVerifiedUser,
  isGatedPath,
  edgeGateAllows,
  json,
  type VerifiedContext,
} from './gate';
export {
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
} from './passkey';
export { issueMagicLink, consumeMagicLink, emailHash } from './magic-link';
