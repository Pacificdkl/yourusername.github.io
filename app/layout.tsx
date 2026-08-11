import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

// Discreet name (CLAUDE.md §7.7 — refined in Phase 7).
export const metadata: Metadata = {
  title: 'Spin',
  // No content in metadata/previews (non-negotiable #9).
  description: '',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">{children}</body>
    </html>
  );
}
