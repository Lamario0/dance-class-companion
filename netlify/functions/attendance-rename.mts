// A signed-in student renamed their profile (attendance slice 3B): put the new
// name on their check-ins and Attendance rows. POST {} with their ID token. The
// name always comes from their stored profile, never the request.
import { adminConfigured, adminDb, json, verifyUser } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { sheetsApi } from '../lib/sheets.mts';
import { renameCheckins } from '../lib/attendanceSheet.mts';

export default withAppCors(async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Not configured.' }, 500);
  const user = await verifyUser(req);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  const db = adminDb();
  const name = (await db.doc(`users/${user.uid}`).get()).data()?.displayName;
  if (typeof name !== 'string' || !name.trim()) return json({ error: 'No profile name to use.' }, 404);
  const changed = await renameCheckins(db, sheetsApi(), 'uid', user.uid, name);
  return json({ status: 'renamed', changed });
});

export const config = {
  path: '/api/attendance-rename',
};
