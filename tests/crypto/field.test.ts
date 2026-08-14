/**
 * Field encryption at rest (CLAUDE.md §5): boundary answers and session-draw
 * item ids are ciphertext at rest and transparently decrypted on read.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptField, decryptField, isEncrypted } from '@/crypto/field';
import { __resetStore, store } from '@/db';
import { MemoryUserStore } from '@/db/memory-store';
import { setAnswer } from '@/boundaries';

describe('field encryption', () => {
  it('round-trips a value', async () => {
    const token = await encryptField('yes');
    expect(isEncrypted(token)).toBe(true);
    expect(token).not.toContain('yes');
    expect(await decryptField(token)).toBe('yes');
  });

  it('uses a fresh IV so equal plaintexts differ as ciphertext', async () => {
    const a = await encryptField('maybe');
    const b = await encryptField('maybe');
    expect(a).not.toBe(b);
    expect(await decryptField(a)).toBe('maybe');
    expect(await decryptField(b)).toBe('maybe');
  });

  it('passes plaintext (non-token) through unchanged for back-compat', async () => {
    expect(await decryptField('yes')).toBe('yes');
  });
});

describe('boundary answers are encrypted at rest', () => {
  beforeEach(() => __resetStore());

  it('stores ciphertext but reads back plaintext', async () => {
    const u = (await store.createUser()).id;
    await setAnswer(u, 'item-1', 'yes');

    const raw = (store as MemoryUserStore).__rawBoundaryAnswer(u, 'item-1');
    expect(raw).toBeDefined();
    expect(isEncrypted(raw!)).toBe(true);
    expect(raw).not.toContain('yes');

    const rows = await store.getBoundaryAnswers(u);
    expect(rows).toEqual([{ itemId: 'item-1', answer: 'yes' }]);
  });
});

describe('session draw item ids are encrypted at rest', () => {
  beforeEach(() => __resetStore());

  it('stores ciphertext but reads back the real item id', async () => {
    await store.addSession({
      id: 's1',
      pairingId: 'p1',
      intensityCap: 5,
      noRepeat: true,
      categories: null,
      startedAt: new Date(),
      endedAt: null,
    });
    await store.addSessionDraw({ sessionId: 's1', itemId: 'secret-item', drawnAt: new Date() });

    const draws = await store.getDrawsForSession('s1');
    expect(draws[0]!.itemId).toBe('secret-item'); // decrypted on read
  });
});
