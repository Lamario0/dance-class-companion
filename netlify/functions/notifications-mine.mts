// Slice 6: the admin notifications this Android device should show in its bell
// (last 30 days). POST { platform }. Signed out: "all app users" ones only;
// signed in: also groups matching the account's level in that dance. The web
// gets none (admin notifications are for the app).
import { Timestamp } from 'firebase-admin/firestore';
import { adminConfigured, adminDb, json, verifyUser } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { levelsIn } from '../lib/notifyAudience.mts';

export default withAppCors(async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Not configured.' }, 500);
  const body = await req.json().catch(() => null);
  if (body?.platform !== 'android') return json({ items: [] });
  const user = await verifyUser(req);
  const since = Timestamp.fromMillis(Date.now() - 30 * 24 * 3600 * 1000);
  const docs = (await adminDb().collection('notifications').where('sentAt', '>=', since).orderBy('sentAt', 'desc').limit(50).get()).docs;
  const items = [];
  for (const d of docs) {
    const n = d.data();
    if (n.audience === 'group') {
      if (!user) continue;
      const lv = (await levelsIn([user.uid], n.dance)).get(user.uid);
      if (lv !== n.level) continue;
    } else if (n.audience !== 'all') continue;
    items.push({ id: d.id, title: n.title, body: n.body, tab: n.tab ?? null, sentAt: n.sentAt.toMillis() });
  }
  return json({ items });
});

export const config = { path: '/api/notifications' };
