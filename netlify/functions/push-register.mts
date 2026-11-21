// Slice 6: register this device for push notifications. POST { token, platform }.
// Signed in (Bearer token): the device is tied to the account; otherwise (or when
// signing out) it is kept as an anonymous app/web device with no uid.
import { FieldValue } from 'firebase-admin/firestore';
import { adminConfigured, adminDb, json, verifyUser } from '../lib/firebaseAdmin.mts';
import { withAppCors } from '../lib/cors.mts';
import { isPlatform, tokenId } from '../lib/push.mts';

export default withAppCors(async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Not configured.' }, 500);
  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || !isPlatform(body?.platform)) {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const user = await verifyUser(req);
  await adminDb().doc(`pushTokens/${tokenId(token)}`).set({
    token,
    platform: body.platform,
    uid: user?.uid ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return json({ status: 'registered', signedIn: !!user });
});

export const config = { path: '/api/push/register' };
