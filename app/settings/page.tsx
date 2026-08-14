import { PrivacyPanel } from '@/ui';

/** Settings — privacy controls (§7.7). Gated by middleware. */
export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-lg font-medium">Privacy &amp; data</h1>
      <PrivacyPanel />
    </main>
  );
}
