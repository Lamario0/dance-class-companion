// Admin only (attendance slice 5): levels. POST { action, ... }
//   set      { uid, dance, level }      promote (any time, any level) or move down; refused above the cap
//   cap      { uid, dance, cap|null }   the highest level the student may reach; refused below their level
//   settings { settings }               the class/month targets (same for every dance)
//   link     { guestId, uid }           a guest's check-ins move to an account
//   unlink   { guestId }                ...and back
// Levels live in levels/{uid}, settings in settings/levels; both are server-written only.
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminConfigured, adminDb, json, requireAdmin } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { sheetsApi } from '../lib/sheets.mts';
import { writeNow } from '../lib/attendanceSheet.mts';
import { linkGuestCheckins, unlinkGuestCheckins } from '../lib/guestLinks.mts';
import { LEVEL_NAMES, isLevel, rank, validSettings, type DanceLevel } from '../../services/levels.ts';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const validDance = (d: unknown): d is string => typeof d === 'string' && d.trim().length > 0 && d.length <= 40 && !/[.`/]/.test(d);

const accountName = async (uid: string) => {
  const db = adminDb();
  const n = (await db.doc(`users/${uid}`).get()).data()?.displayName;
  if (typeof n === 'string' && n.trim()) return n.trim();
  const u = await adminAuth().getUser(uid).catch(() => null);
  return u?.displayName?.trim() || u?.email?.split('@')[0] || 'Dancer';
};

const userExists = async (uid: string) => {
  if (!ID.test(uid) || uid.startsWith('g_')) return false;
  return !!(await adminAuth().getUser(uid).catch(() => null));
};

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
  const db = adminDb();
  const action = body?.action;

  if (action === 'settings') {
    if (!validSettings(body.settings)) return json({ error: 'Targets must be whole numbers from 0 to 120.' }, 400);
    const { basicsClasses, basicsMonths, intermediateClasses, intermediateMonths } = body.settings;
    await db.doc('settings/levels').set({ basicsClasses, basicsMonths, intermediateClasses, intermediateMonths, updatedAt: FieldValue.serverTimestamp() });
    return json({ status: 'saved' });
  }

  if (action === 'set' || action === 'cap') {
    const { uid, dance } = body;
    if (typeof uid !== 'string' || !(await userExists(uid))) return json({ error: 'That student no longer exists.' }, 404);
    if (!validDance(dance)) return json({ error: 'Pick a dance.' }, 400);
    const ref = db.doc(`levels/${uid}`);
    const result = await db.runTransaction(async tx => {
      const cur: DanceLevel = (await tx.get(ref)).data()?.dances?.[dance] ?? { level: '100' };
      if (action === 'set') {
        if (!isLevel(body.level)) return { error: 'Pick a level.', status: 400 };
        if (cur.cap && rank(body.level) > rank(cur.cap)) {
          return { error: `That's above their maximum level (${LEVEL_NAMES[cur.cap]}). Raise or clear the maximum first.`, status: 409 };
        }
        tx.set(ref, { dances: { [dance]: { level: body.level, cap: cur.cap ?? null, since: FieldValue.serverTimestamp() } }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return { level: body.level, cap: cur.cap ?? null };
      }
      const cap = body.cap ?? null;
      if (cap !== null && !isLevel(cap)) return { error: 'Pick a level.', status: 400 };
      if (cap && rank(cur.level) > rank(cap)) {
        return { error: `They're already at ${LEVEL_NAMES[cur.level]}. Move them down first.`, status: 409 };
      }
      tx.set(ref, { dances: { [dance]: { level: cur.level, cap } }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { level: cur.level, cap };
    });
    if ('error' in result) return json({ error: result.error }, result.status);
    return json({ status: 'saved', ...result });
  }

  if (action === 'link' || action === 'unlink') {
    const { guestId } = body;
    if (typeof guestId !== 'string' || !ID.test(guestId)) return json({ error: 'That guest no longer exists.' }, 404);
    let moved: string[];
    let skipped = 0;
    if (action === 'link') {
      const uid = body.uid;
      if (typeof uid !== 'string' || !(await userExists(uid))) return json({ error: 'That student no longer exists.' }, 404);
      const r = await linkGuestCheckins(db, guestId, uid, await accountName(uid));
      if (r.status === 'missing') return json({ error: 'That guest no longer exists.' }, 404);
      if (r.status === 'linked') return json({ error: 'That guest is already linked. Unlink it first.' }, 409);
      ({ moved, skipped } = r);
    } else {
      const r = await unlinkGuestCheckins(db, guestId);
      if (r.status === 'missing') return json({ error: 'That guest no longer exists.' }, 404);
      if (r.status === 'unlinked') return json({ error: "That guest isn't linked." }, 409);
      moved = r.moved;
    }
    if (moved.length) await writeNow(sheetsApi(), db, moved, 3000);
    return json({ status: action === 'link' ? 'linked' : 'unlinked', moved: moved.length, skipped });
  }

  return json({ error: 'Unknown action.' }, 400);
});

export const config = { path: '/api/admin/levels' };
