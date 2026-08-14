'use client';

/** Intensity-cap slider (CLAUDE.md §7.6). 1..5; changes take effect on the next spin. */
export interface IntensitySliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function IntensitySlider({ value, onChange, disabled = false }: IntensitySliderProps) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-sm">
        <span className="opacity-70">Intensity cap</span>
        <span className="font-semibold" aria-live="polite">
          {value}
        </span>
      </span>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        disabled={disabled}
        aria-label="Intensity cap"
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white"
      />
    </label>
  );
}
