/**
 * Discreet identity (CLAUDE.md §7.7): the installable PWA's name and icon must
 * reveal nothing about the app's purpose.
 */
import { describe, it, expect } from 'vitest';
import manifest from '../../app/manifest';

describe('discreet PWA identity', () => {
  const m = manifest();

  it('uses a neutral name and empty description', () => {
    expect(m.name).toBe('Spin');
    expect(m.short_name).toBe('Spin');
    expect(m.description).toBe('');
  });

  it('name reveals nothing suggestive', () => {
    const revealing = /sex|adult|xxx|porn|kink|bdsm|intim|couple|erotic/i;
    expect(revealing.test(String(m.name))).toBe(false);
    expect(revealing.test(String(m.short_name))).toBe(false);
  });

  it('declares an icon', () => {
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons && m.icons.length).toBeGreaterThan(0);
  });
});
