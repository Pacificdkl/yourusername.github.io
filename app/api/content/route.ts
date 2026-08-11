import { json, withVerified } from '@/auth';
import { getShippableItems } from '@/content';

export const runtime = 'nodejs';

/**
 * GET /api/content — the shippable (reviewed) content library. Unreviewed rows
 * are never returned (§6 guard). Gated: verified users only.
 */
export const GET = withVerified(async () => {
  const items = await getShippableItems();
  return json({ items });
});
