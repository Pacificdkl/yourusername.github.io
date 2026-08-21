import { json } from '@/auth';
import { withConsent } from '@/consent';
import { getShippableItems, ensureDevSeed } from '@/content';

export const runtime = 'nodejs';

/**
 * GET /api/content — the shippable (reviewed) content library. Unreviewed rows
 * are never returned (§6 guard). Gated: verified users only.
 */
export const GET = withConsent(async () => {
  await ensureDevSeed(); // dev/test only: no-op in production
  const items = await getShippableItems();
  return json({ items });
});
