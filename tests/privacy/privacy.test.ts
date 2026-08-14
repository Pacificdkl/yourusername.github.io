/**
 * Privacy tests (CLAUDE.md §7.7): PIN lock (hashed, never plaintext), data
 * export (own data only — no identity #2, no partner answers #5), and true
 * delete (hard removal + unpair cascade).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __resetStore, store } from '@/db';
import { setAnswer } from '@/boundaries';
import { createInvite, redeemInvite, confirmPairing, getPairingView } from '@/pairing';
import { setPin, verifyPin, hasPin, exportData, deleteAccount } from '@/privacy';

async function verifiedUser(): Promise<string> {
  const u = await store.createUser();
  await store.markVerified(u.id, { providerRef: 'ref', verifiedAt: new Date() });
  return u.id;
}
async function pairActive(a: string, b: string): Promise<void> {
  const inv = await createInvite(a);
  if (!inv.ok) throw new Error(inv.reason);
  const red = await redeemInvite(inv.code, b);
  if (!red.ok) throw new Error(red.reason);
  const conf = await confirmPairing(red.pairingId, a);
  if (!conf.ok) throw new Error(conf.reason);
}

describe('PIN lock', () => {
  beforeEach(() => __resetStore());

  it('stores only a hash and verifies correctly', async () => {
    const a = await verifiedUser();
    expect(await hasPin(a)).toBe(false);
    await setPin(a, '2468');

    const user = await store.findUser(a);
    expect(user?.pinHash).toBeTruthy();
    expect(user?.pinHash).not.toBe('2468'); // never plaintext
    expect(user?.pinHash?.startsWith('pbkdf2$')).toBe(true);

    expect(await hasPin(a)).toBe(true);
    expect(await verifyPin(a, '2468')).toBe(true);
    expect(await verifyPin(a, '0000')).toBe(false);
  });

  it('verify is false when no PIN is set', async () => {
    const a = await verifiedUser();
    expect(await verifyPin(a, '1234')).toBe(false);
  });
});

describe('data export', () => {
  beforeEach(() => __resetStore());

  it('exports the user\'s own data with no identity fields and no partner answers', async () => {
    const [a, b] = [await verifiedUser(), await verifiedUser()];
    await pairActive(a, b);
    await setAnswer(a, 'shared', 'yes');
    await setAnswer(b, 'shared', 'no');
    await setAnswer(b, 'only-b', 'yes');

    const dump = await exportData(a);

    // Account block: only the permitted verification fields (#2).
    expect(Object.keys(dump.account).sort()).toEqual(
      ['id', 'createdAt', 'ageVerified', 'providerRef', 'verifiedAt'].sort(),
    );

    // Own answers only (#5): A's answer present, B's exclusive item absent.
    expect(dump.boundaries).toEqual([{ itemId: 'shared', answer: 'yes' }]);
    const serialized = JSON.stringify(dump);
    expect(serialized).not.toContain('only-b');
  });
});

describe('true delete', () => {
  beforeEach(() => __resetStore());

  it('hard-deletes the user and cascades; the partner is unpaired but intact', async () => {
    const [a, b] = [await verifiedUser(), await verifiedUser()];
    await pairActive(a, b);
    await setAnswer(a, 'x', 'yes');
    await store.addCredential(a, { id: 'cred-a', publicKey: new Uint8Array([1]), counter: 0 });
    await setPin(a, '1111');

    const pairing = await getPairingView(a);
    await store.addSession({
      id: 's1',
      pairingId: pairing!.pairingId,
      intensityCap: 3,
      noRepeat: true,
      categories: null,
      startedAt: new Date(),
      endedAt: null,
    });
    await store.addSessionDraw({ sessionId: 's1', itemId: 'x', drawnAt: new Date() });

    await deleteAccount(a);

    // A and everything of A's is gone.
    expect(await store.findUser(a)).toBeNull();
    expect(await store.getBoundaryAnswers(a)).toEqual([]);
    expect(await store.findCredentialById('cred-a')).toBeNull();

    // The pairing (shared session history) is gone for the partner too.
    expect(await getPairingView(b)).toBeNull();
    expect(await store.getDrawsForSession('s1')).toEqual([]);

    // But the partner's own account survives.
    expect(await store.findUser(b)).not.toBeNull();
  });
});
