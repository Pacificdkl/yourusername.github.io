'use client';

import type { ContentCategory } from '@/db';

/**
 * Category selector (CLAUDE.md §7.6). Toggling categories narrows the pool;
 * selecting none means "all". Changes take effect on the next spin.
 */
export interface CategorySelectorProps {
  categories: readonly ContentCategory[];
  selected: readonly ContentCategory[];
  onChange: (next: ContentCategory[]) => void;
  disabled?: boolean;
}

export function CategorySelector({
  categories,
  selected,
  onChange,
  disabled = false,
}: CategorySelectorProps) {
  const toggle = (c: ContentCategory) => {
    const next = selected.includes(c)
      ? selected.filter((x) => x !== c)
      : [...selected, c];
    onChange(next);
  };

  return (
    <fieldset disabled={disabled} className="border-0 p-0">
      <legend className="mb-2 text-sm opacity-70">Categories</legend>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const on = selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggle(c)}
              className={`rounded-full border px-3 py-1 text-sm capitalize ${
                on ? 'border-white bg-white text-black' : 'border-white/30 text-white'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
