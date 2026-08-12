/**
 * Field-level encryption at rest (CLAUDE.md §5).
 *
 * `boundary_answers` and `session_draws` hold Article 9 special-category data,
 * so their sensitive values are encrypted before they are persisted and
 * decrypted only when the application reads them. AES-256-GCM (authenticated)
 * via Web Crypto, with a random 96-bit IV per value.
 *
 * Token format: `v1.<ivB64>.<ciphertextB64>` (ciphertext includes the GCM tag).
 *
 * Key management: `DATA_ENCRYPTION_KEY` is a base64-encoded 32-byte key. In
 * production it is required; in dev/test a fixed key is used so the suite runs
 * without configuration. See docs/decisions/0005-boundary-answers-encryption.md
 * for the server-side-encryption decision and the production KMS/envelope plan.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PREFIX = 'v1.';

function b64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKey: Promise<CryptoKey> | null = null;

function keyBytes(): Uint8Array {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (raw) {
    const bytes = fromB64(raw);
    if (bytes.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (base64)');
    return bytes;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATA_ENCRYPTION_KEY is required in production.');
  }
  // Dev/test only — deterministic, never used in production.
  return encoder.encode('dev-only-insecure-data-encryption-key-32'.slice(0, 32));
}

function getKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey('raw', keyBytes() as unknown as BufferSource, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
  }
  return cachedKey;
}

/** True if `value` is one of our encryption tokens. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypts a plaintext string to a storable token. */
export async function encryptField(plaintext: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv); // invariant #6
  const key = await getKey();
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plaintext),
  );
  return `${PREFIX}${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

/**
 * Decrypts a token produced by `encryptField`. If given a plaintext value that
 * is not a token (e.g. legacy data), it is returned unchanged, so reads stay
 * backward-compatible during a migration.
 */
export async function decryptField(token: string): Promise<string> {
  if (!isEncrypted(token)) return token;
  const [, ivB64, ctB64] = token.split('.');
  if (!ivB64 || !ctB64) throw new Error('malformed encryption token');
  const key = await getKey();
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as unknown as BufferSource },
    key,
    fromB64(ctB64) as unknown as BufferSource,
  );
  return decoder.decode(pt);
}

/** Test-only: reset the cached key (after changing the env key in a test). */
export function __resetKeyCache(): void {
  cachedKey = null;
}
