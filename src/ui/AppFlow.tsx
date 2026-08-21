'use client';

import { useEffect, useState } from 'react';
import { LoginForm } from './LoginForm';
import { VerifyForm } from './VerifyForm';
import { SpinSession } from './SpinSession';

type State =
  | { phase: 'loading' }
  | { phase: 'login' }
  | { phase: 'verify' }
  | { phase: 'app' };

/**
 * Top-level onboarding flow. Reads the caller's own status from the ungated
 * /api/auth/session and shows the right screen: sign in → age check → the app
 * (SpinSession, which then handles consent → pairing → spin). The real security
 * is the server-side gate on every data route; this just routes the UI.
 */
export function AppFlow() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d: { authenticated?: boolean; ageVerified?: boolean }) => {
        if (cancelled) return;
        if (!d.authenticated) setState({ phase: 'login' });
        else if (!d.ageVerified) setState({ phase: 'verify' });
        else setState({ phase: 'app' });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'login' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  switch (state.phase) {
    case 'loading':
      return <main className="p-6 text-sm opacity-70">Loading…</main>;
    case 'login':
      return <LoginForm />;
    case 'verify':
      return <VerifyForm />;
    case 'app':
      return <SpinSession />;
  }
}
