import { SpinSession } from '@/ui';

/**
 * Home — the session screen. A gated page (middleware sends unverified visitors
 * to /verify). SpinSession handles the paired / not-paired / no-session states.
 */
export default function HomePage() {
  return <SpinSession />;
}
