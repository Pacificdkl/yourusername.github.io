'use client';

/**
 * Always-visible safeword + one-tap stop (CLAUDE.md §7.6). Rendered fixed to the
 * viewport so it is reachable at every moment of a session. The stop button ends
 * the session immediately.
 */
export interface SafewordBarProps {
  safeword: string;
  onStop: () => void;
  stopping?: boolean;
}

export function SafewordBar({ safeword, onStop, stopping = false }: SafewordBarProps) {
  return (
    <div
      role="region"
      aria-label="Safety controls"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t border-white/15 bg-black/90 px-4 py-3 backdrop-blur"
    >
      <p className="text-sm">
        <span className="opacity-60">Safeword</span>{' '}
        <span className="font-semibold tracking-wide">{safeword}</span>
      </p>
      <button
        type="button"
        onClick={onStop}
        disabled={stopping}
        aria-label="Stop the session now"
        className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {stopping ? 'Stopping…' : 'Stop'}
      </button>
    </div>
  );
}
