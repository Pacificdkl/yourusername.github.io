'use client';

import { useCallback, useEffect, useState } from 'react';

interface PairingView {
  pairingId: string;
  partnerId: string;
  status: 'pending' | 'active';
}

/**
 * Pairing screen (CLAUDE.md §7.2): create a single-use invite code for your
 * partner, or enter theirs. Redeeming makes it pending; the issuer confirms to
 * activate (dual confirmation). Polls so the other side's actions appear.
 */
export function PairingPanel({ onActive }: { onActive: () => void }) {
  const [pairing, setPairing] = useState<PairingView | null>(null);
  const [code, setCode] = useState<string | null>(null); // a code I created
  const [entry, setEntry] = useState(''); // a code I'm entering
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/pairing').then((r) => r.json());
    const p = (res as { pairing: PairingView | null }).pairing;
    setPairing(p);
    if (p?.status === 'active') onActive();
  }, [onActive]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000); // pick up partner's actions
    return () => clearInterval(t);
  }, [load]);

  const createCode = async () => {
    setError(null);
    const res = await fetch('/api/pairing/invite', { method: 'POST' });
    const data = (await res.json()) as { code?: string; error?: string };
    if (data.code) setCode(data.code);
    else setError('Could not create a code.');
  };

  const redeem = async () => {
    setError(null);
    const res = await fetch('/api/pairing/redeem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: entry.trim().toUpperCase() }),
    });
    if (res.ok) await load();
    else setError('That code did not work — check it and try again.');
  };

  const confirm = async () => {
    if (!pairing) return;
    await fetch('/api/pairing/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pairingId: pairing.pairingId }),
    });
    await load();
  };

  if (pairing?.status === 'pending') {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6 text-center">
        <h1 className="text-lg font-medium">Almost paired</h1>
        <p className="text-sm opacity-70">
          Waiting for both of you to confirm. Tap confirm below; ask your partner
          to do the same on their device.
        </p>
        <button
          type="button"
          onClick={confirm}
          className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
        >
          Confirm pairing
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-lg font-medium">Pair with your partner</h1>

      <section className="space-y-2 rounded-2xl border border-white/10 p-4">
        <h2 className="text-sm font-semibold">Create a code</h2>
        <p className="text-xs opacity-60">Share it with your partner to pair.</p>
        {code ? (
          <p className="py-2 text-center text-2xl font-bold tracking-widest">{code}</p>
        ) : (
          <button
            type="button"
            onClick={createCode}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
          >
            Create code
          </button>
        )}
      </section>

      <section className="space-y-2 rounded-2xl border border-white/10 p-4">
        <h2 className="text-sm font-semibold">Enter their code</h2>
        <div className="flex gap-2">
          <input
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="6-character code"
            aria-label="Partner's code"
            className="flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm uppercase"
          />
          <button
            type="button"
            onClick={redeem}
            disabled={entry.trim().length < 6}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            Pair
          </button>
        </div>
      </section>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </main>
  );
}
