// Every 15 minutes (attendance slice 3A): catch up slot rows the sheet missed,
// pull slot edits made in the sheet, and add Classes rows for new class columns.
// Scheduled functions only run on the published (production) deploy.
import { adminConfigured, adminDb } from '../lib/firebaseAdmin.mts';
import { sheetsApi } from '../lib/sheets.mts';
import { syncSheet } from '../lib/sheetSync.mts';

export default async (_req?: Request) => {
  const api = sheetsApi();
  if (!api || !adminConfigured()) {
    console.warn('sheet sync skipped: not configured');
    return new Response(null, { status: 204 });
  }
  try {
    console.log('sheet sync', JSON.stringify(await syncSheet(api, adminDb())));
  } catch (err) {
    console.error('sheet sync failed', err);
  }
  return new Response(null, { status: 204 });
};

export const config = {
  schedule: '*/15 * * * *',
};
