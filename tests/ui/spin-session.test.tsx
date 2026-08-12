// @vitest-environment jsdom
/**
 * SpinSession integration (CLAUDE.md §7.6), with a mocked API. Confirms the
 * always-visible safeword + one-tap stop, and that spinning shows the item the
 * SERVER returned (the UI never picks it).
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { ContentItemRecord } from '@/db';
import { SpinSession } from '@/ui/SpinSession';

const activeSession = {
  sessionId: 's1',
  intensityCap: 3,
  noRepeat: true,
  categories: null,
  drawCount: 0,
};

const drawnItem: ContentItemRecord = {
  id: 'i1',
  title: 'Side-lying rest',
  category: 'position',
  description: 'A gentle description.',
  intensity: 1,
  difficulty: 1,
  tags: [],
  safetyNotes: '',
  source: 'The Perfumed Garden',
  licence: 'Public domain',
  reviewedBy: 'reviewer',
  reviewedAt: new Date(),
};

let calls: string[] = [];

function installFetch(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    'GET /api/pairing': { pairing: { pairingId: 'p1', partnerId: 'u2', status: 'active' } },
    'GET /api/session': { session: activeSession },
    'POST /api/session/spin': { item: drawnItem },
    'POST /api/session/end': { ended: true },
    'POST /api/session/config': { session: activeSession },
    'POST /api/session/start': { session: activeSession },
    ...overrides,
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    calls.push(key);
    return { json: async () => routes[key] ?? {} } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SpinSession', () => {
  it('shows the always-visible safeword and stop for an active session', async () => {
    installFetch();
    render(<SpinSession />);
    expect(await screen.findByText('RED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop the session now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^spin$/i })).toBeInTheDocument();
  });

  it('spinning displays the item the server returned', async () => {
    installFetch();
    render(<SpinSession />);
    await screen.findByText('RED');

    fireEvent.click(screen.getByRole('button', { name: /^spin$/i }));
    expect(await screen.findByText('Side-lying rest')).toBeInTheDocument();
    expect(calls).toContain('POST /api/session/spin');
  });

  it('one-tap stop ends the session', async () => {
    installFetch();
    render(<SpinSession />);
    await screen.findByText('RED');

    fireEvent.click(screen.getByRole('button', { name: /stop the session now/i }));
    await waitFor(() => expect(calls).toContain('POST /api/session/end'));
    expect(await screen.findByText(/start session/i)).toBeInTheDocument();
  });

  it('prompts to pair when there is no pairing', async () => {
    installFetch({ 'GET /api/pairing': { pairing: null } });
    render(<SpinSession />);
    expect(await screen.findByText(/pair with your partner first/i)).toBeInTheDocument();
  });
});
