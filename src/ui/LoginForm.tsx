'use client';

import { useState } from 'react';

/**
 * Sign-in screen (CLAUDE.md §3): magic-link fallback wired for real use.
 *
 * In dev, the API returns the link directly (`devLink`) so you can sign in
 * without email set up — we follow it automatically. In production there is no
 * `devLink`; the link is emailed and the user is told to check their inbox.
 * (Passkey sign-in is the primary method in production; this fallback is the
 * simplest path for testing.)
 */
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'sent' | 'error'>('idle');

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('working');
    try {
      const res = await fetch('/api/auth/magic/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; devLink?: string };
      if (!res.ok || !data.ok) {
        setStatus('error');
        return;
      }
      if (data.devLink) {
        // Dev/test: consume the link right away and go to the app.
        const token = new URL(data.devLink).searchParams.get('token') ?? '';
        const consumed = await fetch('/api/auth/magic/consume', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (consumed.ok) {
          window.location.assign('/');
          return;
        }
        setStatus('error');
        return;
      }
      setStatus('sent'); // production: emailed
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-medium">Sign in</h1>
      {status === 'sent' ? (
        <p className="max-w-sm text-sm opacity-70">
          Check your email for a one-time sign-in link.
        </p>
      ) : (
        <form onSubmit={signIn} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            className="rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={status === 'working'}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {status === 'working' ? 'Signing in…' : 'Continue with email'}
          </button>
          {status === 'error' && (
            <p className="text-xs text-red-400">Something went wrong. Try again.</p>
          )}
        </form>
      )}
    </main>
  );
}
