// Check a signed-in, verified student into a class slot (attendance slice 1).
// POST { slotId } with Authorization: Bearer <ID token>.
// Once per slot per studio day (America/Detroit): the check-in id is
// "<slotId>__<YYYY-MM-DD>__<uid>", created with create() so a repeat is a no-op.
// Snapshots the slot's current title and label, so later title edits don't
// rewrite history. The label and title come from the Slots worksheet when it has
// a row for the slot (slice 3A: the sheet wins), else from the slot itself.
import { FieldValue } from 'firebase-admin/firestore';
import { adminConfigured, adminDb, json, verifyUser } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { studioDate, checkinId } from '../lib/studio.mts';
import { sheetsApi } from '../lib/sheets.mts';
import { sheetSlot } from '../lib/sheetSync.mts';

export default withAppCors(async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Check-in is not configured.' }, 500);

  const user = await verifyUser(req);
  if (!user) return json({ error: 'Please sign in to check in.' }, 401);
  if (user.email_verified !== true) return json({ error: 'Verify your email to check in.', code: 'unverified' }, 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const slotId = typeof body?.slotId === 'string' ? body.slotId : '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(slotId)) return json({ error: "This code isn't active.", code: 'inactive' }, 404);

  const db = adminDb();
  const slotSnap = await db.doc(`slots/${slotId}`).get();
  const slot = slotSnap.data();
  if (!slotSnap.exists || !slot || slot.archived === true || typeof slot.title !== 'string' || typeof slot.label !== 'string') {
    return json({ error: "This code isn't active.", code: 'inactive' }, 404);
  }

  const fromSheet = await sheetSlot(sheetsApi(), slotId);
  const label = fromSheet?.label ?? (slot.label as string);
  const title = fromSheet?.title ?? (slot.title as string);

  const profile = (await db.doc(`users/${user.uid}`).get()).data();
  const name = (profile?.displayName as string) || user.name || user.email?.split('@')[0] || 'Dancer';
  const date = studioDate();
  const ref = db.doc(`checkins/${checkinId(slotId, date, user.uid)}`);
  const result = { title, label, date };

  try {
    await ref.create({
      uid: user.uid,
      name,
      slotId,
      slotLabel: label,
      title,
      date,
      at: FieldValue.serverTimestamp(),
      method: 'qr',
    });
  } catch (err: any) {
    // ALREADY_EXISTS (gRPC 6): checked in to this slot today already.
    if (err?.code === 6 || /already exists/i.test(String(err?.message))) {
      return json({ status: 'already', ...result });
    }
    console.error('checkin failed', err);
    return json({ error: "Couldn't check you in. Please try again." }, 500);
  }
  return json({ status: 'checked-in', ...result });
});

export const config = {
  path: '/api/checkin',
};
