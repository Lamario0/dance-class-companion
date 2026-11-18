// Admin only (attendance slice 3A): run the sheet sync now ("Refresh class list"
// on Class slots). Same work as the 15-minute job.
import { adminConfigured, adminDb, json, requireAdmin } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { sheetsApi } from '../lib/sheets.mts';
import { syncSheet } from '../lib/sheetSync.mts';

export default withAppCors(async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Admin tools are not configured.' }, 500);
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;
  const api = sheetsApi();
  if (!api) return json({ error: "The Google Sheet isn't connected here." }, 503);
  try {
    return json({ status: 'synced', ...(await syncSheet(api, adminDb())) });
  } catch (err) {
    console.error('sheet sync failed', err);
    return json({ error: "Couldn't reach the Google Sheet. Try again in a minute." }, 502);
  }
});

export const config = {
  path: '/api/admin/sheet-sync',
};
