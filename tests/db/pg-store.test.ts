/**
 * PgStore functional tests against real Postgres (pglite). Exercises every
 * Store method so the SQL binding is verified, not just the schema. RLS
 * enforcement itself is proven separately in pg-schema.test.ts (it requires a
 * non-superuser role; pglite runs as superuser here, so these tests validate
 * query/mapping correctness).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PgStore, type Db } from '@/db/pg-store';

const MIG_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));
const uuid = () => crypto.randomUUID();

let pg: PGlite;
let store: PgStore;

function makeDb(client: PGlite): Db {
  return {
    query: (text, params) => client.query(text, params as unknown[]) as never,
    transaction: (fn) =>
      client.transaction(async (tx) => fn({ query: (t, p) => tx.query(t, p as unknown[]) as never })) as never,
  };
}

beforeAll(async () => {
  pg = new PGlite();
  const files = readdirSync(MIG_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  for (const f of files) await pg.exec(readFileSync(join(MIG_DIR, f), 'utf8'));
  store = new PgStore(makeDb(pg));
});

beforeEach(async () => {
  // Clean slate between tests (respect FK order via cascade from users/content).
  await pg.exec(`
    delete from session_draws; delete from sessions; delete from boundary_answers;
    delete from pairings; delete from invite_codes; delete from magic_tokens;
    delete from email_identities; delete from webauthn_challenges;
    delete from webauthn_credentials; delete from favourites;
    delete from content_items; delete from users;
  `);
});

describe('users + verification + consent + pin', () => {
  it('creates, reads, and updates a user', async () => {
    const u = await store.createUser();
    expect(u.ageVerified).toBe(false);
    expect(await store.findUser(u.id)).toMatchObject({ id: u.id, ageVerified: false });

    await store.markVerified(u.id, { providerRef: 'ref', verifiedAt: new Date() });
    await store.setPinHash(u.id, 'pbkdf2$x');
    await store.setConsent(u.id, 'v1', new Date());
    const v = await store.findUser(u.id);
    expect(v?.ageVerified).toBe(true);
    expect(v?.providerRef).toBe('ref');
    expect(v?.pinHash).toBe('pbkdf2$x');
    expect(v?.consentVersion).toBe('v1');

    await store.withdrawConsent(u.id);
    expect((await store.findUser(u.id))?.consentVersion).toBeNull();
  });
});

describe('passkey credentials + challenges', () => {
  it('stores and reads credentials and bumps the counter', async () => {
    const u = await store.createUser();
    await store.addCredential(u.id, {
      id: 'cred1',
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
      transports: ['internal'],
    });
    const creds = await store.getCredentials(u.id);
    expect(creds).toHaveLength(1);
    expect(Array.from(creds[0]!.publicKey)).toEqual([1, 2, 3]);

    const found = await store.findCredentialById('cred1');
    expect(found?.userId).toBe(u.id);
    await store.updateCredentialCounter('cred1', 5);
    expect((await store.findCredentialById('cred1'))?.cred.counter).toBe(5);
  });

  it('takes a challenge once and honours expiry', async () => {
    const u = await store.createUser();
    await store.putChallenge({ userId: u.id, challenge: 'ch', expiresAt: new Date(Date.now() + 60000) });
    expect((await store.takeChallenge(u.id))?.challenge).toBe('ch');
    expect(await store.takeChallenge(u.id)).toBeNull(); // consumed

    await store.putChallenge({ userId: u.id, challenge: 'old', expiresAt: new Date(Date.now() - 1000) });
    expect(await store.takeChallenge(u.id)).toBeNull(); // expired
  });
});

describe('magic tokens + email index', () => {
  it('consumes a token once and links email', async () => {
    const u = await store.createUser();
    await store.linkEmailHash('eh', u.id);
    expect(await store.findUserIdByEmailHash('eh')).toBe(u.id);

    await store.putMagicToken({ tokenHash: 'th', userId: u.id, expiresAt: new Date(Date.now() + 60000), consumedAt: null });
    expect((await store.consumeMagicToken('th', new Date()))?.userId).toBe(u.id);
    expect(await store.consumeMagicToken('th', new Date())).toBeNull(); // single use
  });
});

describe('pairing + invites + sessions', () => {
  it('runs the pairing lifecycle and cascades on unpair', async () => {
    const a = await store.createUser();
    const b = await store.createUser();

    await store.createInvite({ code: 'ABC123', issuer: a.id, expiresAt: new Date(Date.now() + 60000), consumedAt: null });
    expect((await store.getInvite('ABC123'))?.issuer).toBe(a.id);
    expect((await store.consumeInvite('ABC123', new Date()))?.code).toBe('ABC123');
    expect(await store.consumeInvite('ABC123', new Date())).toBeNull();

    const pairingId = uuid();
    await store.createPairing({ id: pairingId, userA: a.id, userB: b.id, status: 'pending', createdAt: new Date(), confirmedA: false, confirmedB: true });
    expect((await store.getPairingForUser(b.id))?.id).toBe(pairingId);
    await store.updatePairing({ id: pairingId, userA: a.id, userB: b.id, status: 'active', createdAt: new Date(), confirmedA: true, confirmedB: true });
    expect((await store.getPairing(pairingId))?.status).toBe('active');

    const sessionId = uuid();
    await store.addSession({ id: sessionId, pairingId, intensityCap: 3, noRepeat: true, categories: ['position'], startedAt: new Date(), endedAt: null });
    expect((await store.getActiveSessionForPairing(pairingId))?.id).toBe(sessionId);
    await store.addSessionDraw({ sessionId, itemId: 'secret-item', drawnAt: new Date() });
    const draws = await store.getDrawsForSession(sessionId);
    expect(draws[0]!.itemId).toBe('secret-item'); // decrypted on read

    const result = await store.unpairUser(a.id);
    expect(result.pairingId).toBe(pairingId);
    expect(result.deletedSessionIds).toEqual([sessionId]);
    expect(await store.getPairingForUser(b.id)).toBeNull();
    expect(await store.getDrawsForSession(sessionId)).toEqual([]); // cascaded
  });
});

describe('boundary answers (encrypted, RLS-scoped)', () => {
  it('round-trips and stays ciphertext at rest', async () => {
    const u = await store.createUser();
    const item = uuid();
    await store.setBoundaryAnswer(u.id, item, 'yes');
    expect(await store.getBoundaryAnswer(u.id, item)).toBe('yes');
    expect(await store.getBoundaryAnswers(u.id)).toEqual([{ itemId: item, answer: 'yes' }]);

    // Raw column is ciphertext, not the plaintext enum.
    const raw = await pg.query<{ answer: string }>('select answer from boundary_answers where item_id = $1', [item]);
    expect(raw.rows[0]!.answer).not.toBe('yes');
    expect(raw.rows[0]!.answer.startsWith('v1.')).toBe(true);
  });
});

describe('content constraints + review guard', () => {
  it('rejects a BDSM item with empty safety_notes and hides unreviewed items', async () => {
    await expect(
      store.addContentItem({
        id: uuid(), title: 'x', category: 'bdsm', description: 'd', intensity: 2, difficulty: 2,
        tags: [], safetyNotes: '', source: 's', licence: 'l', reviewedBy: null, reviewedAt: null,
      }),
    ).rejects.toThrow();

    const reviewed = uuid();
    await store.addContentItem({ id: reviewed, title: 'r', category: 'position', description: 'd', intensity: 1, difficulty: 1, tags: ['t'], safetyNotes: '', source: 's', licence: 'l', reviewedBy: null, reviewedAt: null });
    await store.markContentReviewed(reviewed, 'rev', new Date());
    await store.addContentItem({ id: uuid(), title: 'u', category: 'position', description: 'd', intensity: 1, difficulty: 1, tags: [], safetyNotes: '', source: 's', licence: 'l', reviewedBy: null, reviewedAt: null });

    expect((await store.getAllContentItems()).length).toBe(2);
    const shippable = await store.getShippableContentItems();
    expect(shippable.map((i) => i.id)).toEqual([reviewed]);
  });
});

describe('true delete cascades; partner survives', () => {
  it('removes the user and their data, unpairs, keeps the partner', async () => {
    const a = await store.createUser();
    const b = await store.createUser();
    await store.addCredential(a.id, { id: 'ca', publicKey: new Uint8Array([9]), counter: 0 });
    await store.setBoundaryAnswer(a.id, uuid(), 'yes');
    const pairingId = uuid();
    await store.createPairing({ id: pairingId, userA: a.id, userB: b.id, status: 'active', createdAt: new Date(), confirmedA: true, confirmedB: true });

    await store.deleteUser(a.id);

    expect(await store.findUser(a.id)).toBeNull();
    expect(await store.findCredentialById('ca')).toBeNull();
    expect(await store.getBoundaryAnswers(a.id)).toEqual([]);
    expect(await store.getPairingForUser(b.id)).toBeNull();
    expect(await store.findUser(b.id)).not.toBeNull();
  });
});
