// Deletes the caller's account: their profile and everything under it
// (users/{uid}, including notes once they exist) and their Firebase Auth login.
// Chat messages are kept; slice 3 shows them as "Former student".
//
// Done server-side so it works without a fresh re-login and so the profile can't
// be left behind if the browser closes halfway.
import { adminAuth, adminDb, adminConfigured, json, verifyUser } from '../lib/firebaseAdmin.mts';

export default async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not configured.');
    return json({ error: 'Account deletion is not configured.' }, 500);
  }

  const user = await verifyUser(req);
  if (!user) return json({ error: 'Please sign in again, then try deleting your account.' }, 401);

  // Data first, then the login: if the second step fails the student can simply retry
  // (both steps are safe to repeat), and no login is left pointing at half-deleted data.
  try {
    await adminAuth().revokeRefreshTokens(user.uid); // other devices stop refreshing right away
    const db = adminDb();
    await db.recursiveDelete(db.collection('users').doc(user.uid));
    await adminAuth().deleteUser(user.uid);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') return json({ ok: true }); // already gone (a retry)
    console.error('delete-account failed for', user.uid, err);
    return json({ error: "Couldn't finish deleting your account. Please try again in a minute." }, 500);
  }
  return json({ ok: true });
};

export const config = {
  path: '/api/delete-account',
};
