import { AppFlow } from '@/ui';

/**
 * Home — the onboarding + session flow. `AppFlow` routes between sign in, age
 * check, and the app based on the caller's own status; every data route is
 * still gated server-side (non-negotiable #1).
 */
export default function HomePage() {
  return <AppFlow />;
}
