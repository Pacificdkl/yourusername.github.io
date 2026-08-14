import type { ContentCategory, ContentItemRecord } from '@/db';

export type { ContentCategory, ContentItemRecord } from '@/db';

/** A new item before it has an id or review status. */
export type NewContentItem = Omit<ContentItemRecord, 'id' | 'reviewedBy' | 'reviewedAt'> & {
  id?: string;
};

export function isCategory(v: unknown): v is ContentCategory {
  return (
    v === 'position' || v === 'massage' || v === 'sensation' || v === 'bdsm' || v === 'roleplay'
  );
}
