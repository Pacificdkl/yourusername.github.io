/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Non-negotiable #8: no third-party analytics, ad SDKs, session replay, or
  // payload-capturing error reporters. Keep the network surface auditable.
  async headers() {
    // Strict CSP: no external origins, consistent with non-negotiable #8 (no
    // third-party scripts/SDKs/font CDNs). 'unsafe-inline' for script/style is
    // required by Next's inline bootstrap and Tailwind's injected styles until a
    // nonce-based policy is wired (tracked in the security review).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // Content in notification previews / caches is a leak vector; keep
          // pages out of shared caches by default (non-negotiable #9 spirit).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
