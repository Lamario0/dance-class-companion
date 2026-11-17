// Admin only (spec slice 4): every account with name, email, joined, last sign-in,
// sign-in method, verified and admin. Names come from the profile (what the app
// shows), falling back to the Auth display name.
import { adminAuth, adminDb, adminConfigured, json, requireAdmin } from '../lib/firebaseAdmin.mts';

const MAX_USERS = 5000;

export default async (req: Request, _context?: unknown) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  if (!adminConfigured()) return json({ error: 'Admin tools are not configured.' }, 500);
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;

  const users: import('firebase-admin/auth').UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await adminAuth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken && users.length < MAX_USERS);

  // Profile names, read in chunks.
  const db = adminDb();
  const names = new Map<string, string>();
  for (let i = 0; i < users.length; i += 500) {
    const refs = users.slice(i, i + 500).map(u => db.collection('users').doc(u.uid));
    const profiles = await db.getAll(...refs);
    profiles.filter(p => p.exists).forEach(p => names.set(p.id, (p.data()?.displayName as string) || ''));
  }

  const rows = users.map(u => ({
    uid: u.uid,
    name: names.get(u.uid) || u.displayName || '',
    email: u.email || '',
    joined: u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : null,
    lastSignIn: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : null,
    method: u.providerData.some(p => p.providerId === 'google.com') ? 'google' : 'email',
    verified: u.emailVerified,
    admin: u.customClaims?.['admin'] === true,
    self: u.uid === auth.caller.uid,
  }));
  rows.sort((a, b) => (b.joined ?? '').localeCompare(a.joined ?? ''));

  return json({ users: rows, truncated: !!pageToken });
};

export const config = {
  path: '/api/admin/users',
};
