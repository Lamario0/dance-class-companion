// Admin only (attendance slice 2): check someone into a slot by hand, for today
// or a past studio day. POST { slotId, date, uid } for an account or
// { slotId, date, guestId } for a guest. Same once-per-slot-per-day id scheme as
// QR check-ins, so a QR and a manual check-in can't double up.
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminConfigured, adminDb, json, requireAdmin } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { checkinId, guestCheckinId, isIsoDate, studioDate, SLOT_ID } from '../lib/studio.mts';
import { sheetLooksDown, sheetsApi } from '../lib/sheets.mts';
import { sheetSlot } from '../lib/sheetSync.mts';
import { writeNow } from '../lib/attendanceSheet.mts';

const GUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;
const OLDEST = '2020-01-01';

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
  const { slotId, date, uid, guestId } = body ?? {};
  if (typeof slotId !== 'string' || !SLOT_ID.test(slotId)) return json({ error: "That class slot doesn't exist." }, 404);
  if (!isIsoDate(date) || date < OLDEST) return json({ error: 'Pick a valid date.' }, 400);
  if (date > studioDate()) return json({ error: "You can't check someone in for a future day." }, 400);
  const forAccount = typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !uid.includes('/') && !uid.startsWith('g_'); // g_ marks guests in check-in ids
  const forGuest = typeof guestId === 'string' && GUEST_ID.test(guestId);
  if (forAccount === forGuest) return json({ error: 'Pick one person.' }, 400);

  const db = adminDb();
  const slot = (await db.doc(`slots/${slotId}`).get()).data();
  if (!slot || slot.archived === true || typeof slot.title !== 'string' || typeof slot.label !== 'string') {
    return json({ error: "That class slot isn't active." }, 404);
  }

  // The person's name (snapshotted, like QR check-ins).
  let name: string;
  if (forAccount) {
    try {
      const user = await adminAuth().getUser(uid);
      const profile = (await db.doc(`users/${uid}`).get()).data();
      name = (profile?.displayName as string) || user.displayName || user.email?.split('@')[0] || 'Dancer';
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') return json({ error: 'That account no longer exists.' }, 404);
      throw err;
    }
  } else {
    const guest = (await db.doc(`guests/${guestId}`).get()).data();
    if (!guest || typeof guest.name !== 'string') return json({ error: 'That guest no longer exists.' }, 404);
    // Slice 5: a guest linked to an account is checked in as that account.
    if (guest.linkedUid) return json({ error: 'That guest is linked to an account. Check in the account instead.' }, 409);
    name = guest.name;
  }

  // The class title for that day: what the day's first check-in recorded, else the slot's current title.
  // (Earliest `at`, then id: the same rule the admin page uses, so both agree if the title changed mid-day.)
  const sameDay = await db.collection('checkins').where('slotId', '==', slotId).where('date', '==', date).get();
  const atMs = (d: FirebaseFirestore.QueryDocumentSnapshot) => d.data().at?.toMillis?.() ?? Infinity;
  const recorded = [...sameDay.docs].sort((a, b) => atMs(a) - atMs(b) || a.id.localeCompare(b.id))[0]?.data();
  // (No check-in yet that day: the Slots worksheet's values when it has a row, slice 3A.)
  const api = sheetLooksDown() ? null : sheetsApi();
  const sheetBudgetEnds = Date.now() + 3000;
  const current = recorded ? null : await sheetSlot(api, slotId);
  const title = typeof recorded?.title === 'string' ? recorded.title : (current?.title ?? (slot.title as string));
  const slotLabel = typeof recorded?.slotLabel === 'string' ? recorded.slotLabel : (current?.label ?? (slot.label as string));

  const id = forAccount ? checkinId(slotId, date, uid) : guestCheckinId(slotId, date, guestId);
  try {
    await db.doc(`checkins/${id}`).create({
      ...(forAccount ? { uid } : { guestId }),
      name,
      slotId,
      slotLabel,
      title,
      date,
      at: FieldValue.serverTimestamp(),
      method: 'manual',
      addedBy: auth.caller.uid,
      sheet: 'pending',
      sheetAt: FieldValue.serverTimestamp(), // when its row write started (the job waits 90 s after)
    });
  } catch (err: any) {
    if (err?.code === 6 || /already exists/i.test(String(err?.message))) return json({ status: 'already', id, name });
    console.error('admin-checkin failed', err);
    return json({ error: "Couldn't check them in. Please try again." }, 500);
  }
  await writeNow(sheetLooksDown() ? null : api, db, [id], Math.min(2500, sheetBudgetEnds - Date.now())); // its Attendance row (slice 3B)
  return json({ status: 'checked-in', id, name, title, label: slotLabel, date });
});

export const config = {
  path: '/api/admin/checkin',
};
