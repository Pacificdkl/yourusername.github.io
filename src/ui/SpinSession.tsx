'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContentItemRecord, ContentCategory } from '@/db';
import type { SessionView } from '@/session';
import { Wheel } from './Wheel';
import { ResultCard } from './ResultCard';
import { IntensitySlider } from './IntensitySlider';
import { CategorySelector } from './CategorySelector';
import { SafewordBar } from './SafewordBar';

// Local literal so the client bundle never imports server-only content code.
const ALL_CATEGORIES: ContentCategory[] = ['position', 'massage', 'sensation', 'bdsm', 'roleplay'];

// Default safeword; per-couple configuration is a later refinement.
const DEFAULT_SAFEWORD = 'RED';

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } });
  return res.json() as Promise<T>;
}
async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  return res.json() as Promise<T>;
}

/**
 * The session screen (CLAUDE.md §7.6): wheel, result card, category selector,
 * intensity-cap slider, and the always-visible safeword + one-tap stop. All
 * randomness is server-side (/api/session/spin); this component only presents
 * the result it is given.
 */
export function SpinSession() {
  const [loading, setLoading] = useState(true);
  const [paired, setPaired] = useState<boolean | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [result, setResult] = useState<{ item: ContentItemRecord | null; exhausted: boolean } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [consent, setConsent] = useState<{ granted: boolean; currentVersion: string } | null>(null);

  const refresh = useCallback(async () => {
    const cons = await getJSON<{ consent: { granted: boolean; currentVersion: string } }>(
      '/api/consent',
    );
    setConsent(cons.consent);
    if (cons.consent.granted) {
      const [pairing, sess] = await Promise.all([
        getJSON<{ pairing: unknown | null }>('/api/pairing'),
        getJSON<{ session: SessionView | null }>('/api/session'),
      ]);
      setPaired(Boolean(pairing.pairing));
      setSession(sess.session);
    }
    setLoading(false);
  }, []);

  const giveConsent = async () => {
    if (!consent) return;
    await postJSON('/api/consent', { granted: true, version: consent.currentVersion });
    await refresh();
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = async () => {
    const res = await postJSON<{ session?: SessionView }>('/api/session/start', {});
    if (res.session) setSession(res.session);
  };

  const doSpin = async () => {
    setSpinning(true);
    try {
      const res = await postJSON<{ item?: ContentItemRecord | null }>('/api/session/spin');
      const item = res.item ?? null;
      setResult({ item, exhausted: item === null });
      const sess = await getJSON<{ session: SessionView | null }>('/api/session');
      setSession(sess.session);
    } finally {
      setSpinning(false);
    }
  };

  const stop = async () => {
    setStopping(true);
    try {
      await postJSON('/api/session/end');
      setSession(null);
      setResult(null);
    } finally {
      setStopping(false);
    }
  };

  const updateConfig = async (patch: { intensityCap?: number; categories?: ContentCategory[] }) => {
    const res = await postJSON<{ session?: SessionView }>('/api/session/config', patch);
    if (res.session) setSession(res.session);
  };

  if (loading) return <main className="p-6 text-sm opacity-70">Loading…</main>;

  if (consent && !consent.granted) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-lg font-medium">Your explicit consent</h1>
        <p className="text-sm opacity-80">
          Spin processes information about your sexual preferences. Under UK data
          protection law this is special-category data, so we need your{' '}
          <strong>explicit consent</strong> to store and use it.
        </p>
        <p className="text-sm opacity-70">
          This is separate from any terms of service. You can withdraw it at any
          time in Settings, which stops this processing.
        </p>
        <button
          type="button"
          onClick={giveConsent}
          className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
        >
          I explicitly consent
        </button>
      </main>
    );
  }

  if (!paired) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-medium">Pair with your partner first</h1>
        <p className="mt-2 text-sm opacity-70">
          Spin needs an active pairing before a session can start.
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-lg font-medium">Ready to spin</h1>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-white px-8 py-3 font-semibold text-black"
        >
          Start session
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6 pb-24">
      <Wheel onSpin={doSpin} busy={spinning} />
      <ResultCard item={result?.item ?? null} exhausted={result?.exhausted ?? false} />

      <div className="space-y-4 rounded-2xl border border-white/10 p-4">
        <IntensitySlider
          value={session.intensityCap}
          onChange={(v) => void updateConfig({ intensityCap: v })}
        />
        <CategorySelector
          categories={ALL_CATEGORIES}
          selected={session.categories ?? []}
          onChange={(next) => void updateConfig({ categories: next })}
        />
      </div>

      <SafewordBar safeword={DEFAULT_SAFEWORD} onStop={stop} stopping={stopping} />
    </main>
  );
}
