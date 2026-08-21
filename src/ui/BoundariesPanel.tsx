'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContentItemRecord, ContentCategory } from '@/db';
import type { Answer } from '@/boundaries';

/**
 * Boundaries screen (CLAUDE.md §7.3): each partner privately marks every item
 * yes / maybe / no. Only your own answers are shown (invariant #5); the shared
 * pool is the intersection. Saving is instant (§7.3).
 */
const CHOICES: { value: Answer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

export function BoundariesPanel() {
  const [items, setItems] = useState<ContentItemRecord[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const load = useCallback(async () => {
    const [content, mine] = await Promise.all([
      fetch('/api/content').then((r) => r.json()) as Promise<{ items: ContentItemRecord[] }>,
      fetch('/api/boundaries').then((r) => r.json()) as Promise<{
        answers: { itemId: string; answer: Answer }[];
      }>,
    ]);
    setItems(content.items ?? []);
    const map: Record<string, Answer> = {};
    for (const a of mine.answers ?? []) map[a.itemId] = a.answer;
    setAnswers(map);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async (itemId: string, answer: Answer) => {
    setAnswers((prev) => ({ ...prev, [itemId]: answer })); // optimistic
    await fetch('/api/boundaries', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId, answer }),
    });
  };

  if (!items) return <p className="text-sm opacity-60">Loading your boundaries…</p>;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Your boundaries</h2>
        <p className="text-xs opacity-60">
          Private to you. An item is only ever suggested if you both say Yes.
        </p>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-white/10 p-3">
            <div className="mb-2">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs capitalize opacity-50">
                {(item.category as ContentCategory)} · intensity {item.intensity}
              </p>
            </div>
            <div className="flex gap-2">
              {CHOICES.map((c) => {
                const on = answers[item.id] === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => choose(item.id, c.value)}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${
                      on ? 'border-white bg-white text-black' : 'border-white/30 text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
