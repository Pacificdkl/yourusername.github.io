/**
 * Content service (CLAUDE.md §6, §7.4). Insert (with the schema constraints
 * enforced by the store), the review workflow, and the shippable query.
 */

import { store } from '@/db';
import type { ContentItemRecord } from '@/db';
import type { NewContentItem } from './types';

function newId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes); // invariant #6
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Inserts a content item as UNREVIEWED. The store enforces the §6 constraints
 * and throws on violation (a failed insert). An item cannot ship until a human
 * reviews it.
 */
export async function insertItem(item: NewContentItem): Promise<ContentItemRecord> {
  const record: ContentItemRecord = {
    id: item.id ?? newId(),
    title: item.title,
    category: item.category,
    description: item.description,
    intensity: item.intensity,
    difficulty: item.difficulty,
    tags: item.tags,
    safetyNotes: item.safetyNotes,
    source: item.source,
    licence: item.licence,
    reviewedBy: null,
    reviewedAt: null,
  };
  await store.addContentItem(record);
  return record;
}

/** Marks an item reviewed — the gate to shipping (§6). */
export async function reviewItem(id: string, reviewedBy: string): Promise<void> {
  await store.markContentReviewed(id, reviewedBy, new Date());
}

/** Reviewed items only (the production guard). */
export async function getShippableItems(): Promise<ContentItemRecord[]> {
  return store.getShippableContentItems();
}

/** The set of ids that may be drawn (reviewed items). */
export async function getShippableItemIds(): Promise<Set<string>> {
  const items = await store.getShippableContentItems();
  return new Set(items.map((i) => i.id));
}
