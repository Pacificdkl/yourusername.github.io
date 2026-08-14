/**
 * Login screen. Passkey primary, magic-link fallback (CLAUDE.md §3). Reachable
 * without a session. Interactive client wiring is Phase 1 UI work; this is the
 * server shell.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-medium">Sign in</h1>
      <p className="max-w-sm text-sm opacity-70">
        Use a passkey, or request a one-time email link.
      </p>
    </main>
  );
}
