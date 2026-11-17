// Admin only (spec slice 4): delete a student's account, exactly like self-deletion
// (login, profile, notes; chat relabelled "Former student"). Not your own account.
import { adminConfigured, json, requireAdmin } from '../lib/firebaseAdmin.mts';
import { deleteAccountData } from '../lib/accounts.mts';
import { withAppCors } from '../lib/cors.mts';

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
  const uid = typeof body?.uid === 'string' ? body.uid : '';
  if (!uid || uid.length > 128) return json({ error: 'Invalid request.' }, 400);
  if (uid === auth.caller.uid) {
    return json({ error: 'Delete your own account from your account sheet instead.' }, 400);
  }

  try {
    await deleteAccountData(uid);
  } catch (err) {
    console.error('admin-delete-user failed for', uid, err);
    return json({ error: "Couldn't finish deleting that account. Please try again in a minute." }, 500);
  }
  return json({ ok: true });
});

export const config = {
  path: '/api/admin/delete-user',
};
