/**
 * Initial seed set (CLAUDE.md §6). NO scraping. Sourced only from:
 *  - public-domain texts (Burton's 1883 translations), or
 *  - commissioned original prose.
 * Every record carries `source` + `licence`. Descriptions are plain,
 * non-graphic, non-clinical. Items are inserted UNREVIEWED — a human must
 * review each before it can ship.
 *
 * These are starter records to exercise the schema and pool; the real editorial
 * seed set and any line art are produced during Phase 4 content work.
 */

import { insertItem } from './service';
import type { NewContentItem } from './types';

const PUBLIC_DOMAIN = 'Public domain';
const COMMISSIONED = '© Spin — commissioned original work';

const SAFETY_RESOURCE = 'https://www.scarleteen.com/';

export const SEED: NewContentItem[] = [
  {
    title: 'Twining embrace',
    category: 'sensation',
    description:
      'Standing face to face in a close, entwined embrace — one of the classical forms of affectionate touch.',
    intensity: 1,
    difficulty: 1,
    tags: ['embrace', 'gentle', 'standing'],
    safetyNotes: '',
    source: "Burton's 1883 Kama Sutra",
    licence: PUBLIC_DOMAIN,
  },
  {
    title: 'Yawning position',
    category: 'position',
    description:
      "A reclining, face-to-face position with the receiving partner's knees raised and apart; noted for comfort and closeness.",
    intensity: 2,
    difficulty: 1,
    tags: ['reclining', 'face-to-face'],
    safetyNotes: '',
    source: "Burton's 1883 Kama Sutra",
    licence: PUBLIC_DOMAIN,
  },
  {
    title: 'Side-lying rest',
    category: 'position',
    description:
      'Both partners lie on their sides facing each other; a gentle, low-effort arrangement.',
    intensity: 1,
    difficulty: 1,
    tags: ['side-lying', 'relaxed'],
    source: 'The Perfumed Garden (Burton translation)',
    licence: PUBLIC_DOMAIN,
    safetyNotes: '',
  },
  {
    title: 'Ascending position',
    category: 'position',
    description:
      'The receiving partner reclines while the other kneels upright; a calm, unhurried arrangement.',
    intensity: 2,
    difficulty: 2,
    tags: ['kneeling', 'reclining'],
    source: 'Ananga Ranga (Burton & Arbuthnot translation)',
    licence: PUBLIC_DOMAIN,
    safetyNotes: '',
  },
  {
    title: 'Warm-oil back massage',
    category: 'massage',
    description:
      'A slow back and shoulder massage with warmed oil, to relax and connect before anything else.',
    intensity: 1,
    difficulty: 1,
    tags: ['massage', 'warm-up', 'gentle'],
    source: 'Commissioned original prose',
    licence: COMMISSIONED,
    safetyNotes: '',
  },
  {
    title: 'Wrist restraint with a soft tie',
    category: 'bdsm',
    description:
      "One partner's wrists are loosely secured with a soft fabric tie while the other leads the touch.",
    intensity: 3,
    difficulty: 3,
    tags: ['restraint', 'bondage', 'trust'],
    source: 'Commissioned original prose',
    licence: COMMISSIONED,
    safetyNotes:
      'Use a soft tie that releases quickly. Leave two fingers of slack and check circulation ' +
      '(colour, warmth) and for numbness or tingling (nerve compression) every few minutes. Agree ' +
      'a safeword first. Plan aftercare — warmth, water, reassurance. Never leave a bound person ' +
      `alone. Learn more: ${SAFETY_RESOURCE}`,
  },
];

/** Loads the seed set into the store (UNREVIEWED). Idempotent-ish for dev. */
export async function seedContent(): Promise<void> {
  for (const item of SEED) {
    await insertItem(item);
  }
}
