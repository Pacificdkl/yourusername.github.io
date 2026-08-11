/**
 * Home — a gated page (middleware sends unverified visitors to /verify). The
 * real session flow lands in Phase 6; this is a placeholder shell.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm opacity-70">Spin</p>
    </main>
  );
}
