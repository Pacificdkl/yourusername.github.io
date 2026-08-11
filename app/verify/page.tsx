/**
 * Verification screen. The ONLY destination for unverified sessions
 * (non-negotiable #1). The interactive provider flow is built out in Phase 1
 * client work; this is the server shell the gate redirects to.
 */
export default function VerifyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-medium">Verify you are an adult</h1>
      <p className="max-w-sm text-sm opacity-70">
        Spin is for verified adults. Complete a one-time age check to continue.
        We store only that the check passed — never your documents or details.
      </p>
    </main>
  );
}
