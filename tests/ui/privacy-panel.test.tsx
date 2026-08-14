// @vitest-environment jsdom
/**
 * PrivacyPanel (CLAUDE.md §7.7): export link, PIN control, and a two-step
 * (confirmed) true-delete.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { PrivacyPanel } from '@/ui/PrivacyPanel';

let calls: string[] = [];

function installFetch(routes: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    'GET /api/privacy/pin': { hasPin: false },
    'POST /api/privacy/pin': { ok: true },
    'POST /api/privacy/delete': { deleted: true },
    ...routes,
  };
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    calls.push(key);
    return { ok: true, json: async () => table[key] ?? {} } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PrivacyPanel', () => {
  it('offers export, PIN, and delete controls', async () => {
    installFetch();
    render(<PrivacyPanel />);
    const link = await screen.findByRole('link', { name: /download export/i });
    expect(link).toHaveAttribute('href', '/api/privacy/export');
    expect(screen.getByLabelText(/new pin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
  });

  it('requires a confirm step before deleting', async () => {
    installFetch();
    render(<PrivacyPanel />);
    await screen.findByRole('link', { name: /download export/i });

    // First click only reveals the confirm button; no delete call yet.
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    expect(calls).not.toContain('POST /api/privacy/delete');

    fireEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    await waitFor(() => expect(calls).toContain('POST /api/privacy/delete'));
    expect(await screen.findByText(/have been deleted/i)).toBeInTheDocument();
  });
});
