import { json, withVerified } from '@/auth';
import { setAnswer, getMyAnswers } from '@/boundaries';
import type { Answer } from '@/boundaries';

export const runtime = 'nodejs';

const ANSWERS: readonly Answer[] = ['yes', 'maybe', 'no'];
function isAnswer(v: unknown): v is Answer {
  return typeof v === 'string' && (ANSWERS as readonly string[]).includes(v);
}

/**
 * GET /api/boundaries — the caller's OWN answers only (invariant #5). There is
 * no endpoint that returns a partner's answers.
 */
export const GET = withVerified(async (_req, { user }) => {
  return json({ answers: await getMyAnswers(user.id) });
});

/**
 * PUT /api/boundaries  { itemId, answer } — set/edit the caller's own answer.
 * Takes effect immediately (§7.3).
 */
export const PUT = withVerified(async (req, { user }) => {
  const { itemId, answer } = (await req.json().catch(() => ({}))) as {
    itemId?: string;
    answer?: unknown;
  };
  if (!itemId || !isAnswer(answer)) return json({ error: 'invalid_answer' }, 400);
  await setAnswer(user.id, itemId, answer);
  return json({ ok: true });
});
