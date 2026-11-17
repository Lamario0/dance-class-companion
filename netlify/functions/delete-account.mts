// Deletes the caller's account: their profile and everything under it
// (users/{uid}, including notes) and their Firebase Auth login. Chat messages are
// kept but relabelled "Former student" (spec slice 3). Shared with the admin
// delete in netlify/lib/accounts.mts.
//
// Done server-side so it works without a fresh re-login and so the profile can't
// be left behind if the browser closes halfway.
import { adminConfigured, json, verifyUser } from '../lib/firebaseAdmin.mts';
import { deleteAccountData } from '../lib/accounts.mts';

export default async (req: Request, _context?: unknown) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not configured.');
    return json({ error: 'Account deletion is not configured.' }, 500);
  }

  const user = await verifyUser(req);
  if (!user) return json({ error: 'Please sign in again, then try deleting your account.' }, 401);

  try {
    await deleteAccountData(user.uid);
  } catch (err) {
    console.error('delete-account failed for', user.uid, err);
    return json({ error: "Couldn't finish deleting your account. Please try again in a minute." }, 500);
  }
  return json({ ok: true });
};

export const config = {
  path: '/api/delete-account',
};
