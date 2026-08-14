import type { MetadataRoute } from 'next';

/**
 * Web app manifest (CLAUDE.md §1 installable PWA, §7.7 discreet icon + name).
 *
 * The installed identity is deliberately discreet: a neutral name ("Spin") and
 * an abstract icon that reveal nothing about the app's purpose on a home screen.
 * No content, no category hints.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Spin',
    short_name: 'Spin',
    description: '',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
