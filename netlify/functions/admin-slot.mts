// Admin only (attendance slice 3A): create or edit a class slot, keeping its row
// in the Slots worksheet the same. POST { label, title } creates;
// POST { id, label?, title?, archived? } edits. If the sheet can't be reached the
// slot is saved anyway and marked `sheetPending`; the 15-minute job writes it.
import { FieldValue } from 'firebase-admin/firestore';
import { adminConfigured, adminDb, json, requireAdmin } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { SLOT_ID } from '../lib/studio.mts';
import { sheetsApi, withTimeout } from '../lib/sheets.mts';
import { isSlotText, writeSlotRow } from '../lib/sheetSync.mts';

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
  const { id, label, title, archived } = body ?? {};
  const db = adminDb();
  const bad = (t: unknown) => t !== undefined && !isSlotText(t);
  if (bad(label) || bad(title)) return json({ error: 'Day/time and class must be 1-60 characters.' }, 400);
  if (archived !== undefined && typeof archived !== 'boolean') return json({ error: 'Invalid request body.' }, 400);

  let ref;
  if (id === undefined) {
    if (label === undefined || title === undefined) return json({ error: 'Day/time and class are both needed.' }, 400);
    ref = db.collection('slots').doc();
    await ref.create({ label: label.trim(), title: title.trim(), archived: false, createdAt: FieldValue.serverTimestamp(), sheetPending: true });
  } else {
    if (typeof id !== 'string' || !SLOT_ID.test(id)) return json({ error: "That slot doesn't exist." }, 404);
    ref = db.doc(`slots/${id}`);
    if (!(await ref.get()).exists) return json({ error: "That slot doesn't exist." }, 404);
    const patch: Record<string, unknown> = { sheetPending: true };
    if (label !== undefined) patch.label = label.trim();
    if (title !== undefined) patch.title = title.trim();
    if (archived !== undefined) patch.archived = archived;
    await ref.update(patch);
  }

  // Now the sheet. The slot is saved either way.
  const snap = await ref.get();
  const d = snap.data()!;
  const slot = { id: ref.id, label: d.label as string, title: d.title as string, archived: d.archived === true };
  const api = sheetsApi();
  let synced = false;
  if (api) {
    try {
      await withTimeout(writeSlotRow(api, ref.id, slot), 6000);
      // Only if nobody edited it meanwhile; otherwise that edit's own write (or the job) catches up.
      await ref.update({ sheetPending: false }, { lastUpdateTime: snap.updateTime });
      synced = true;
    } catch (err) {
      console.warn('slot saved; sheet write left for the sync job', err);
    }
  }
  return json({ status: 'saved', slot, synced });
});

export const config = {
  path: '/api/admin/slot',
};
