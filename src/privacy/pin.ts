/**
 * PIN hashing for the app lock (CLAUDE.md §7.7). PINs are low-entropy, so we
 * use PBKDF2-SHA256 with a per-PIN random salt and a high iteration count. Only
 * the derived hash is ever stored (users.pin_hash) — never the raw PIN
 * (mirrors the "hash only" rule in §5).
 *
 * Format: `pbkdf2$<iterations>$<saltB64>$<hashB64>`.
 *
 * Biometric unlock is a device/platform concern (WebAuthn / platform
 * authenticator), handled by the passkey layer, not here.
 */

const ITERATIONS = 200_000;
const KEY_LEN = 32;
const encoder = new TextEncoder();

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

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_LEN * 8,
  );
  return new Uint8Array(bits);
}

/** Derives a storable hash string for a PIN. */
export async function hashPin(pin: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt); // invariant #6
  const hash = await derive(pin, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

/** Constant-time comparison of two byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Verifies a PIN against a stored hash string. */
export async function verifyPinHash(stored: string, pin: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const salt = fromB64(parts[2]!);
  const expected = fromB64(parts[3]!);
  const actual = await derive(pin, salt, iterations);
  return timingSafeEqual(actual, expected);
}
