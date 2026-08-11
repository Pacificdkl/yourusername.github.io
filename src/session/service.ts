/**
 * Spin session orchestration (CLAUDE.md §7.5).
 *
 * This is the I/O layer that DRIVES the pure spin engine. `src/spin` stays pure
 * (no I/O, no DB) — §4 — so all the filtering and persistence lives here and the
 * only thing handed to `draw()` is an already-filtered array (invariant #3):
 *
 *   drawable pool (consented ∩ reviewed)  →  intensity cap  →  no-repeat removal
 *     →  draw()  →  record the draw
 *
 * We never draw then reject.
 */

import { store } from '@/db';
import type { ContentItemRecord, SessionRow } from '@/db';
import { draw } from '@/spin';
import { getDrawablePoolForUser } from '@/content';
import { getPairingView } from '@/pairing';

export interface SessionConfig {
  /** 1..5. Items above the cap are filtered out before the draw. Default 5. */
  intensityCap?: number;
  /** No-repeat within the session, implemented as pool removal. Default true. */
  noRepeat?: boolean;
}

export interface SessionView {
  sessionId: string;
  intensityCap: number;
  noRepeat: boolean;
  drawCount: number;
}

export type StartResult =
  | { ok: true; session: SessionView }
  | { ok: false; reason: 'not_paired' };

export type SpinResult =
  | { ok: true; item: ContentItemRecord | null }
  | { ok: false; reason: 'no_session' };

function clampCap(cap: number | undefined): number {
  if (!Number.isFinite(cap)) return 5;
  return Math.min(5, Math.max(1, Math.trunc(cap as number)));
}

function newId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes); // invariant #6
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function viewOf(session: SessionRow): Promise<SessionView> {
  const draws = await store.getDrawsForSession(session.id);
  return {
    sessionId: session.id,
    intensityCap: session.intensityCap,
    noRepeat: session.noRepeat,
    drawCount: draws.length,
  };
}

/** The caller's active pairing id, if the pairing is active. */
async function activePairingId(userId: string): Promise<string | null> {
  const view = await getPairingView(userId);
  return view && view.status === 'active' ? view.pairingId : null;
}

/** Start (or resume) the pairing's session. Idempotent while one is active. */
export async function startSession(userId: string, config: SessionConfig = {}): Promise<StartResult> {
  const pairingId = await activePairingId(userId);
  if (!pairingId) return { ok: false, reason: 'not_paired' };

  const existing = await store.getActiveSessionForPairing(pairingId);
  if (existing) return { ok: true, session: await viewOf(existing) };

  const session: SessionRow = {
    id: newId(),
    pairingId,
    intensityCap: clampCap(config.intensityCap),
    noRepeat: config.noRepeat ?? true,
    startedAt: new Date(),
    endedAt: null,
  };
  await store.addSession(session);
  return { ok: true, session: await viewOf(session) };
}

/**
 * Draw one item. Filters the pool (drawable ∩ intensity cap ∩ not-yet-drawn if
 * no-repeat) and only then draws with the CSPRNG. Returns `item: null` when the
 * filtered pool is empty (exhausted), never a rejected candidate.
 */
export async function spin(userId: string): Promise<SpinResult> {
  const pairingId = await activePairingId(userId);
  if (!pairingId) return { ok: false, reason: 'no_session' };
  const session = await store.getActiveSessionForPairing(pairingId);
  if (!session) return { ok: false, reason: 'no_session' };

  // 1. Drawable pool: consented (both) ∩ reviewed content.
  const drawable = await getDrawablePoolForUser(userId, 'both-yes');
  if (!drawable.ok) return { ok: false, reason: 'no_session' };

  // 2. Load items and apply the intensity cap.
  const items: ContentItemRecord[] = [];
  for (const id of drawable.pool) {
    const item = await store.getContentItem(id);
    if (item && item.intensity <= session.intensityCap) items.push(item);
  }

  // 3. No-repeat as POOL REMOVAL (not post-draw rejection).
  let pool = items;
  if (session.noRepeat) {
    const drawnIds = new Set((await store.getDrawsForSession(session.id)).map((d) => d.itemId));
    pool = items.filter((item) => !drawnIds.has(item.id));
  }

  // 4. Draw from the already-filtered array.
  const picked = draw(pool);
  if (!picked) return { ok: true, item: null };

  await store.addSessionDraw({ sessionId: session.id, itemId: picked.id, drawnAt: new Date() });
  return { ok: true, item: picked };
}

/** End the active session. */
export async function endSession(userId: string): Promise<{ ok: boolean }> {
  const pairingId = await activePairingId(userId);
  if (!pairingId) return { ok: false };
  const session = await store.getActiveSessionForPairing(pairingId);
  if (!session) return { ok: false };
  await store.updateSession({ ...session, endedAt: new Date() });
  return { ok: true };
}

/** The caller's active session view, or null. */
export async function getActiveSessionView(userId: string): Promise<SessionView | null> {
  const pairingId = await activePairingId(userId);
  if (!pairingId) return null;
  const session = await store.getActiveSessionForPairing(pairingId);
  return session ? viewOf(session) : null;
}
