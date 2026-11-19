// Admin only (attendance slice 2): remove a check-in (QR or manual), e.g. a
// mistaken tap. POST { id }. Hard delete, so it also leaves the student's
// My attendance.
import { adminConfigured, adminDb, json, requireAdmin } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { CHECKIN_ID } from '../lib/studio.mts';
import { sheetsApi } from '../lib/sheets.mts';
import { removeNow } from '../lib/attendanceSheet.mts';

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
  const id = body?.id;
  if (typeof id !== 'string' || !CHECKIN_ID.test(id)) return json({ error: 'That check-in no longer exists.' }, 404);

  const db = adminDb();
  const ref = db.doc(`checkins/${id}`);
  if (!(await ref.get()).exists) return json({ error: 'That check-in no longer exists.' }, 404);
  await ref.delete();
  await removeNow(sheetsApi(), db, id, 4000); // its Attendance row (slice 3B), or queued for the job
  return json({ status: 'removed', id });
});

export const config = {
  path: '/api/admin/checkin-remove',
};
