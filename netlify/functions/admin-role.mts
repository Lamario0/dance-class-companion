// Admin only (spec slice 4): grant or remove the admin role.
// - Granting: the person's next page load picks up the new claim (the app
//   refreshes its token once per load).
// - Removing: their refresh tokens are revoked so they must sign in again; an
//   ID token they already hold can still carry the old claim for up to an hour.
// An admin can't remove their own role here (no accidental lock-out).
import { adminAuth, adminConfigured, json, requireAdmin } from '../lib/firebaseAdmin.mts';

export default async (req: Request, _context?: unknown) => {
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
  const uid = typeof body?.uid === 'string' ? body.uid : '';
  const makeAdmin = body?.admin;
  if (!uid || uid.length > 128 || typeof makeAdmin !== 'boolean') return json({ error: 'Invalid request.' }, 400);
  if (uid === auth.caller.uid && !makeAdmin) {
    return json({ error: "You can't remove your own admin role here." }, 400);
  }

  try {
    const user = await adminAuth().getUser(uid);
    const claims = { ...(user.customClaims || {}) };
    if (makeAdmin) claims['admin'] = true;
    else delete claims['admin'];
    await adminAuth().setCustomUserClaims(uid, claims);
    if (!makeAdmin) await adminAuth().revokeRefreshTokens(uid);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') return json({ error: 'That account no longer exists.' }, 404);
    console.error('admin-role failed', err);
    return json({ error: "Couldn't change that role. Please try again." }, 500);
  }
  return json({ ok: true, admin: makeAdmin });
};

export const config = {
  path: '/api/admin/role',
};
