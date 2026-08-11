/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Non-negotiable #8: no third-party analytics, ad SDKs, session replay, or
  // payload-capturing error reporters. Keep the network surface auditable.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content in notification previews / caches is a leak vector; keep
          // pages out of shared caches by default (non-negotiable #9 spirit).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
