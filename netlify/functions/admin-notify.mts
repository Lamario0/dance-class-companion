// Admin only (slice 6): notifications to Android app users.
//   POST { action: 'count', audience }                          -> { devices }
//   POST { action: 'send', audience, title, body, tab|null }    -> { id, devices }
// audience: { kind: 'all' } | { kind: 'group', dance, level }. Each send is kept
// in notifications/{id} for 90 days (TTL on expireAt).
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminConfigured, adminDb, json, requireAdmin } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { isTab, sendTo } from '../lib/push.mts';
import { audienceDevices, parseAudience } from '../lib/notifyAudience.mts';

export const MAX_TITLE = 60;
export const MAX_BODY = 300;
const text = (t: unknown, max: number) => typeof t === 'string' && t.trim().length > 0 && t.trim().length <= max;

export default withAppCors(async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Admin tools are not configured.' }, 500);
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const audience = parseAudience(body?.audience);
  if (!audience) return json({ error: 'Pick who gets it.' }, 400);

  if (body.action === 'count') return json({ devices: (await audienceDevices(audience)).length });
  if (body.action !== 'send') return json({ error: 'Invalid request body.' }, 400);
  if (!text(body.title, MAX_TITLE) || !text(body.body, MAX_BODY)) {
    return json({ error: `Title (up to ${MAX_TITLE}) and message (up to ${MAX_BODY}) are both needed.` }, 400);
  }
  const tab = body.tab == null ? null : isTab(body.tab) ? body.tab : undefined;
  if (tab === undefined) return json({ error: 'Invalid request body.' }, 400);

  const title = body.title.trim();
  const message = body.body.trim();
  const db = adminDb();
  const ref = db.collection('notifications').doc();
  const devices = await audienceDevices(audience);
  const data: Record<string, string> = { kind: 'admin', id: ref.id, title, body: message, tab: tab ?? '' };
  const { sent } = await sendTo(devices, () => ({
    notification: { title, body: message },
    android: { notification: { tag: `admin-${ref.id}`, icon: 'ic_stat_notify', color: '#7c3aed' } },
    data,
  }));
  const u = await adminAuth().getUser(auth.caller.uid).catch(() => null);
  const name = (await db.doc(`users/${auth.caller.uid}`).get()).data()?.displayName || u?.displayName || 'Admin';
  await ref.set({
    title,
    body: message,
    tab,
    audience: audience.kind,
    ...(audience.kind === 'group' ? { dance: audience.dance, level: audience.level } : {}),
    sentBy: auth.caller.uid,
    sentByName: name,
    sentAt: FieldValue.serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + 90 * 24 * 3600 * 1000),
    devices: sent,
    targeted: devices.length,
  });
  return json({ status: 'sent', id: ref.id, devices: sent, targeted: devices.length });
});

export const config = { path: '/api/admin/notify' };
