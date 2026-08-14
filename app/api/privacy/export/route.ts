import { withVerified } from '@/auth';
import { exportData } from '@/privacy';

export const runtime = 'nodejs';

/**
 * GET /api/privacy/export — the caller's own data as a downloadable JSON file.
 * Own data only: no identity fields (#2), no partner answers (#5).
 */
export const GET = withVerified(async (_req, { user }) => {
  const dump = await exportData(user.id);
  return new Response(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="spin-export.json"',
    },
  });
});
