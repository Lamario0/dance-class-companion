// Admin only (attendance slice 3B): a guest was renamed; put the new name on their
// check-ins and Attendance rows. POST { guestId }. The name comes from the saved
// guest, never the request.
import { adminConfigured, adminDb, json, requireAdmin } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { sheetsApi } from '../lib/sheets.mts';
import { renameCheckins } from '../lib/attendanceSheet.mts';

const GUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export default withAppCors(async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Admin tools are not configured.' }, 500);
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const guestId = body?.guestId;
  if (typeof guestId !== 'string' || !GUEST_ID.test(guestId)) return json({ error: 'That guest no longer exists.' }, 404);
  const db = adminDb();
  const guest = (await db.doc(`guests/${guestId}`).get()).data();
  // Slice 5: a linked guest's check-ins carry the account's name.
  if (guest?.linkedUid) return json({ status: 'linked', changed: 0 });
  const name = guest?.name;
  if (typeof name !== 'string' || !name.trim()) return json({ error: 'That guest no longer exists.' }, 404);
  const changed = await renameCheckins(db, sheetsApi(), 'guestId', guestId, name);
  return json({ status: 'renamed', changed });
});

export const config = {
  path: '/api/admin/guest-rename',
};
