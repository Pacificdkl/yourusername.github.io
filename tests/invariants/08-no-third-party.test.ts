/**
 * Non-negotiable #8 — Zero third-party analytics, ad SDKs, session replay, or
 * error reporters that capture payloads.
 *
 * Static guard: no dependency whose name matches a known telemetry/ad/replay/
 * reporter package appears in package.json. This is not exhaustive — human
 * review (§9 checklist) is still required — but it catches the obvious ones in
 * CI. If an error reporter is ever added, it must scrub bodies by default and
 * be added to an explicit, reviewed allowlist here with a decision record.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

const DENY = [
  'google-analytics', 'gtag', 'ga-gtag', 'analytics',
  '@segment', 'segment', 'mixpanel', 'amplitude', 'posthog',
  'hotjar', 'fullstory', '@fullstory', 'logrocket', 'smartlook',
  '@sentry', 'sentry', 'bugsnag', '@bugsnag', 'rollbar', 'datadog', '@datadog',
  'facebook-pixel', 'fbq', 'gtm', 'heap',
];

describe('invariant #8: no third-party analytics / ad / replay / reporters', () => {
  it('no denylisted telemetry package in dependencies', () => {
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const offenders = names.filter((n) =>
      DENY.some((bad) => n === bad || n.startsWith(bad + '/') || n.includes(bad)),
    );
    expect(offenders).toEqual([]);
  });
});
