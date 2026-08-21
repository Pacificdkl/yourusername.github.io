/**
 * Dev/test convenience: make the seed content available and reviewed so a local
 * tester sees real suggestions. NEVER runs in production (there, content is
 * added by editors and reviewed by humans — §6). Guarded by NODE_ENV and only
 * seeds when the library is empty; idempotent.
 */
import { store } from '@/db';
import { insertItem, reviewItem } from './service';
import { SEED } from './seed';

// (imported by content read paths so local testers see suggestions)

let done = false;

export async function ensureDevSeed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  if (done) return;
  done = true;
  if ((await store.getAllContentItems()).length > 0) return;
  for (const item of SEED) {
    const rec = await insertItem(item);
    await reviewItem(rec.id, 'dev-seed');
  }
}
