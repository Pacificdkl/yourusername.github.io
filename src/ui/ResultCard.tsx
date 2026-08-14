'use client';

import type { ContentItemRecord } from '@/db';

/**
 * Result card (CLAUDE.md §7.6). Shows the drawn item. For BDSM items the
 * safety notes are shown prominently (§6). Attribution (source + licence) is
 * always shown. `item === null` renders a neutral placeholder.
 */
export interface ResultCardProps {
  item: ContentItemRecord | null;
  exhausted?: boolean;
}

export function ResultCard({ item, exhausted = false }: ResultCardProps) {
  if (!item) {
    return (
      <div className="rounded-2xl border border-white/15 p-6 text-center text-sm opacity-70">
        {exhausted ? 'Nothing left in the pool for these settings.' : 'Spin to begin.'}
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-white/15 p-6">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide opacity-60">
        <span className="capitalize">{item.category}</span>
        <span aria-hidden>·</span>
        <span>intensity {item.intensity}</span>
        <span aria-hidden>·</span>
        <span>difficulty {item.difficulty}</span>
      </div>
      <h2 className="text-xl font-semibold">{item.title}</h2>
      <p className="mt-2 text-sm leading-relaxed opacity-90">{item.description}</p>

      {item.safetyNotes.trim().length > 0 && (
        <section
          aria-label="Safety notes"
          className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm"
        >
          <h3 className="mb-1 font-semibold text-amber-200">Safety</h3>
          <p className="leading-relaxed opacity-90">{item.safetyNotes}</p>
        </section>
      )}

      <footer className="mt-4 text-xs opacity-50">
        {item.source} — {item.licence}
      </footer>
    </article>
  );
}
