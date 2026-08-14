'use client';

import { useEffect, useState } from 'react';

/**
 * Privacy controls (CLAUDE.md §7.7): export, PIN lock, and true delete. The
 * delete action requires an explicit confirm because it is irreversible.
 */
export function PrivacyPanel() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [consentGranted, setConsentGranted] = useState<boolean>(false);

  useEffect(() => {
    void fetch('/api/privacy/pin')
      .then((r) => r.json())
      .then((d: { hasPin?: boolean }) => setHasPin(Boolean(d.hasPin)));
    void fetch('/api/consent')
      .then((r) => r.json())
      .then((d: { consent?: { granted?: boolean } }) => setConsentGranted(Boolean(d.consent?.granted)));
  }, []);

  const withdrawConsent = async () => {
    const res = await fetch('/api/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ granted: false }),
    });
    if (res.ok) setConsentGranted(false);
  };

  const savePin = async () => {
    const res = await fetch('/api/privacy/pin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setPinSaved(true);
      setHasPin(true);
      setPin('');
    }
  };

  const doDelete = async () => {
    const res = await fetch('/api/privacy/delete', { method: 'POST' });
    if (res.ok) setDeleted(true);
  };

  if (deleted) {
    return (
      <div className="rounded-2xl border border-white/15 p-6 text-sm">
        Your account and all its data have been deleted.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/15 p-5">
        <h2 className="text-sm font-semibold">Export your data</h2>
        <p className="mt-1 text-xs opacity-70">
          Download your own data. Your partner&apos;s answers are never included.
        </p>
        <a
          href="/api/privacy/export"
          download="spin-export.json"
          className="mt-3 inline-block rounded-full border border-white/30 px-4 py-2 text-sm"
        >
          Download export
        </a>
      </section>

      <section className="rounded-2xl border border-white/15 p-5">
        <h2 className="text-sm font-semibold">App lock (PIN)</h2>
        <p className="mt-1 text-xs opacity-70">
          {hasPin ? 'A PIN is set. Enter a new one to replace it.' : 'No PIN set yet.'}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            aria-label="New PIN"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setPinSaved(false);
            }}
            placeholder="4–10 digits"
            className="flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={savePin}
            disabled={!/^\d{4,10}$/.test(pin)}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            Save PIN
          </button>
        </div>
        {pinSaved && <p className="mt-2 text-xs text-green-400">PIN saved.</p>}
      </section>

      {consentGranted && (
        <section className="rounded-2xl border border-white/15 p-5">
          <h2 className="text-sm font-semibold">Consent</h2>
          <p className="mt-1 text-xs opacity-70">
            You have given explicit consent to process your preferences. You can
            withdraw it; this stops that processing.
          </p>
          <button
            type="button"
            onClick={withdrawConsent}
            className="mt-3 rounded-full border border-white/30 px-4 py-2 text-sm"
          >
            Withdraw consent
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-red-500/40 p-5">
        <h2 className="text-sm font-semibold text-red-300">Delete account</h2>
        <p className="mt-1 text-xs opacity-70">
          Permanently deletes your account and all your data, and unpairs you. This cannot be undone.
        </p>
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-3 rounded-full border border-red-500/60 px-4 py-2 text-sm text-red-300"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={doDelete}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-full border border-white/30 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
