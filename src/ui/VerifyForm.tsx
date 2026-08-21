'use client';

import { useState } from 'react';

/**
 * Age-verification screen (non-negotiable #1). Starts a provider check and
 * completes it. With the stub provider (dev/test) this approves immediately;
 * with a real provider it hands off to the provider's hosted flow.
 */
export function VerifyForm() {
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');

  const verify = async () => {
    setStatus('working');
    try {
      // Begin the check (stub returns an internal handoff; real providers a URL).
      await fetch('/api/verify/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      // Complete it. The stub approves; a real provider posts back via webhook.
      const res = await fetch('/api/verify/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const data = (await res.json()) as { ageVerified?: boolean };
      if (res.ok && data.ageVerified) {
        window.location.assign('/');
        return;
      }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-medium">Verify you are an adult</h1>
      <p className="max-w-sm text-sm opacity-70">
        Spin is for verified adults. Complete a one-time age check to continue.
        We store only that the check passed — never your documents or details.
      </p>
      <button
        type="button"
        onClick={verify}
        disabled={status === 'working'}
        className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {status === 'working' ? 'Checking…' : 'Complete age check'}
      </button>
      {status === 'error' && <p className="text-xs text-red-400">Something went wrong. Try again.</p>}
    </main>
  );
}
