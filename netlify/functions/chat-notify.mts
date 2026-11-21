// Slice 6: called by the poster's app right after a chat message is saved.
// POST { id }. Sends one notification per message (marked `notifiedAt`), only
// for messages under 2 minutes old, to every signed-in account's devices except
// the poster's, accounts that turned chat notifications off, and accounts that
// muted the poster (admins can't be muted). No sign-in needed: guests post too.
import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminConfigured, adminDb, json } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { allDevices, sendTo } from '../lib/push.mts';
import { muteKey, readMutes } from '../../services/mutes.ts';

const MAX_AGE_MS = 2 * 60 * 1000;
/** One alert per poster per 30 s: a burst of messages buzzes people once. */
const PER_POSTER_MS = 30 * 1000;
const ID = /^[A-Za-z0-9]{1,64}$/;

export default withAppCors(async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Not configured.' }, 500);
  const body = await req.json().catch(() => null);
  if (typeof body?.id !== 'string' || !ID.test(body.id)) return json({ error: 'Invalid request body.' }, 400);
  const db = adminDb();
  const ref = db.doc(`chatMessages/${body.id}`);

  // Claim the message once.
  const claim = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const m = snap.data();
    if (!m || m.deleted === true) return { error: json({ error: 'No such message.' }, 404) };
    const at = m.createdAt instanceof Timestamp ? m.createdAt.toMillis() : 0;
    if (!at || Date.now() - at > MAX_AGE_MS) return { error: json({ error: 'Too old to notify.' }, 409) };
    if (m.notifiedAt) return { error: json({ status: 'already' }, 200) };
    tx.update(ref, { notifiedAt: FieldValue.serverTimestamp() });
    return { m };
  });
  if ('error' in claim) return claim.error!;
  const m = claim.m!;
  const posterUid = typeof m.uid === 'string' ? m.uid : null;
  // A real admin (by claim, not just the stored role) can't be muted.
  const posterIsAdmin = !!posterUid && m.role === 'admin'
    && (await adminAuth().getUser(posterUid).then(u => u.customClaims?.['admin'] === true, () => false));
  const key = muteKey({ uid: posterUid, author: String(m.author ?? '') });

  // Throttle per poster (the message stays marked, so it's never retried).
  const lastRef = db.doc(`chatNotifyLast/${createHash('sha256').update(key).digest('hex')}`);
  const throttled = await db.runTransaction(async tx => {
    const last = (await tx.get(lastRef)).data()?.at;
    if (last instanceof Timestamp && Date.now() - last.toMillis() < PER_POSTER_MS) return true;
    tx.set(lastRef, { at: Timestamp.now() });
    return false;
  });
  if (throttled) return json({ status: 'throttled' });

  const devices = (await allDevices()).filter(d => d.uid && d.uid !== posterUid);
  const uids = [...new Set(devices.map(d => d.uid!))];
  const prefs = new Map<string, { off: boolean; muted: Set<string> }>();
  for (let i = 0; i < uids.length; i += 300) {
    const snaps = await db.getAll(...uids.slice(i, i + 300).map(u => db.doc(`users/${u}`)));
    snaps.forEach(s => {
      const d = s.data();
      prefs.set(s.id, { off: d?.chatNotify === false, muted: new Set(readMutes(d?.muted).map(x => x.k)) });
    });
  }
  // Only real accounts with a profile get chat notifications.
  const to = devices.filter(d => {
    const p = prefs.get(d.uid!);
    return p && !p.off && (posterIsAdmin || !p.muted.has(key));
  });

  const author = String(m.author ?? 'Someone').slice(0, 40);
  const title = m.parentId ? `${author} replied in chat` : `${author} in chat`;
  const text = String(m.text ?? '').replace(/\s+/g, ' ').trim();
  const bodyText = text.length > 140 ? `${text.slice(0, 139)}…` : text;
  const data = { kind: 'chat', tab: 'news', id: body.id, title, body: bodyText, tag: 'chat' };
  const { sent } = await sendTo(to, platform =>
    platform === 'android'
      ? { notification: { title, body: bodyText }, android: { collapseKey: 'chat', notification: { tag: 'chat', icon: 'ic_stat_notify', color: '#7c3aed' } }, data }
      : { data, webpush: { headers: { Urgency: 'high' } } },
  );
  return json({ status: 'sent', devices: sent });
});

export const config = { path: '/api/chat-notify' };
