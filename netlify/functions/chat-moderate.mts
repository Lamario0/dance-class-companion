// Instructor-only chat moderation (edit / delete).
//
// Firestore rules don't let browsers change or remove chat messages, so this
// function does it with the Admin SDK after checking the admin session token
// handed out by /api/admin-login (same HMAC scheme as verify-admin.mts).
//
// Needs two Netlify env vars:
//   ADMIN_SESSION_SECRET      — already used by verify-admin.mts
//   FIREBASE_SERVICE_ACCOUNT  — the service-account JSON for dance-class-companion
import type { Context } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

const validToken = (token: string, secret: string) => {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return Number(payload) > Date.now();
};

const MAX_TEXT = 1000;
const COLLECTION = 'chatMessages';

let dbPromise: Promise<FirebaseFirestore.Firestore> | null = null;
const getDb = () => {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');
      if (!getApps().length) {
        const sa = JSON.parse(process.env['FIREBASE_SERVICE_ACCOUNT'] as string);
        initializeApp({ credential: cert(sa) });
      }
      return getFirestore();
    })();
  }
  return dbPromise;
};

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const secret = process.env['ADMIN_SESSION_SECRET'];
  if (!secret || !process.env['FIREBASE_SERVICE_ACCOUNT']) {
    console.error('ADMIN_SESSION_SECRET or FIREBASE_SERVICE_ACCOUNT is not configured.');
    return json({ error: 'Chat moderation is not configured.' }, 500);
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!validToken(token, secret)) return json({ error: 'Your instructor session has expired. Unlock again.' }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!/^[A-Za-z0-9]{1,64}$/.test(id)) return json({ error: 'Invalid message id.' }, 400);

  const db = await getDb();
  const col = db.collection(COLLECTION);

  if (body.type === 'edit') {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > MAX_TEXT) return json({ error: 'Message must be 1–1000 characters.' }, 400);
    await col.doc(id).update({ text });
    return json({ ok: true });
  }

  if (body.type === 'delete') {
    // Remove the message and every reply under it.
    const ids = [id];
    for (let i = 0; i < ids.length && ids.length < 500; i++) {
      const children = await col.where('parentId', '==', ids[i]).select().get();
      children.forEach(d => ids.push(d.id));
    }
    const batch = db.batch();
    ids.forEach(x => batch.delete(col.doc(x)));
    await batch.commit();
    return json({ ok: true, deleted: ids.length });
  }

  return json({ error: 'Unknown action.' }, 400);
};

export const config = {
  path: '/api/chat-moderate',
};
