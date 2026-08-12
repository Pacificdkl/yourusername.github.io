'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { randomInt } from '@/spin';

/**
 * The wheel (CLAUDE.md §7.6). This is the ONLY component that uses Framer
 * Motion (§3).
 *
 * IMPORTANT: the wheel is presentation only. Where it visually lands is
 * cosmetic — the actual selection is made server-side by the spin engine and
 * arrives via the parent's `onSpin` handler. The wheel never picks the result
 * and must never bias it. The cosmetic rotation uses the CSPRNG (not
 * Math.random) purely so successive spins look different (invariant #6).
 */
export interface WheelProps {
  onSpin: () => void | Promise<void>;
  busy: boolean;
  disabled?: boolean;
}

export function Wheel({ onSpin, busy, disabled = false }: WheelProps) {
  const [rotation, setRotation] = useState(0);

  const handleSpin = async () => {
    if (busy || disabled) return;
    // Cosmetic target: several full turns plus a random offset. Not the result.
    const turns = 4 + randomInt(3); // 4..6 turns
    const offset = randomInt(360);
    setRotation((r) => r + turns * 360 + offset);
    await onSpin();
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        data-testid="wheel-dial"
        className="h-56 w-56 rounded-full border-8 border-white/20"
        style={{
          background:
            'conic-gradient(from 0deg, #1f2937, #374151, #1f2937, #374151, #1f2937, #374151, #1f2937, #374151)',
        }}
        animate={{ rotate: rotation }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden
      />
      <button
        type="button"
        onClick={handleSpin}
        disabled={busy || disabled}
        className="rounded-full bg-white px-8 py-3 text-base font-semibold text-black disabled:opacity-50"
      >
        {busy ? 'Spinning…' : 'Spin'}
      </button>
    </div>
  );
}
