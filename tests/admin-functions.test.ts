// Admin functions (spec slice 4, criteria 3-6) against the emulators. Needs: npm run emulators
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb } = await import('../netlify/lib/firebaseAdmin.mts');
const { default: listUsers } = await import('../netlify/functions/admin-users.mts');
const { default: setRole } = await import('../netlify/functions/admin-role.mts');
const { default: deleteUser } = await import('../netlify/functions/admin-delete-user.mts');

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const stamp = Date.now();
const PASSWORD = 'admin-test-pass-1';

/** Create (or reset) an email account; returns uid. */
const makeAccount = async (tag: string, opts: { verified?: boolean; admin?: boolean } = {}) => {
  const email = `${tag}-${stamp}@test.dev`;
  const u = await adminAuth().createUser({ email, password: PASSWORD, emailVerified: opts.verified ?? true, displayName: tag });
  if (opts.admin) await adminAuth().setCustomUserClaims(u.uid, { admin: true });
  await adminDb().doc(`users/${u.uid}`).set({ displayName: `${tag} name`, createdAt: new Date() });
  return { uid: u.uid, email };
};

/** A fresh ID token (carries current claims and verification). */
const tokenFor = async (email: string) => {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const body = await res.json();
  assert.ok(body.idToken, `sign-in failed: ${JSON.stringify(body)}`);
  return body.idToken as string;
};

const call = (fn: (r: Request) => Promise<Response>, method: string, token?: string, body?: unknown) =>
  fn(
    new Request('http://localhost/api/admin/x', {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

let boss: { uid: string; email: string };
let student: { uid: string; email: string };
let unverifiedAdmin: { uid: string; email: string };
let bossToken: string;

before(async () => {
  boss = await makeAccount('boss', { admin: true });
  student = await makeAccount('student');
  unverifiedAdmin = await makeAccount('unverified', { admin: true, verified: false });
  bossToken = await tokenFor(boss.email);
});

test('every admin function refuses no token, a student token and an unverified admin token', async () => {
  const studentToken = await tokenFor(student.email);
  const unverifiedToken = await tokenFor(unverifiedAdmin.email);
  for (const [fn, method, body] of [
    [listUsers, 'GET', undefined],
    [setRole, 'POST', { uid: student.uid, admin: true }],
    [deleteUser, 'POST', { uid: student.uid }],
  ] as const) {
    assert.equal((await call(fn, method)).status, 401);
    assert.equal((await call(fn, method, 'garbage')).status, 401);
    assert.equal((await call(fn, method, studentToken, body)).status, 403);
    assert.equal((await call(fn, method, unverifiedToken, body)).status, 403);
  }
  assert.equal((await adminAuth().getUser(student.uid)).customClaims?.admin, undefined, 'nothing changed');
});

test('the list shows name, email, method, verified, admin and marks yourself', async () => {
  const res = await call(listUsers, 'GET', bossToken);
  assert.equal(res.status, 200);
  const { users } = await res.json();
  const me = users.find((u: any) => u.uid === boss.uid);
  const s = users.find((u: any) => u.uid === student.uid);
  assert.equal(me.self, true);
  assert.equal(me.admin, true);
  assert.equal(s.name, 'student name'); // profile name wins
  assert.equal(s.email, student.email);
  assert.equal(s.method, 'email');
  assert.equal(s.verified, true);
  assert.equal(s.admin, false);
  assert.ok(s.joined && s.lastSignIn !== undefined);
});

test('make admin, then remove admin (with token revocation)', async () => {
  assert.equal((await call(setRole, 'POST', bossToken, { uid: student.uid, admin: true })).status, 200);
  assert.equal((await adminAuth().getUser(student.uid)).customClaims?.admin, true);
  const before = (await adminAuth().getUser(student.uid)).tokensValidAfterTime;
  await new Promise(r => setTimeout(r, 1100));
  assert.equal((await call(setRole, 'POST', bossToken, { uid: student.uid, admin: false })).status, 200);
  const after = await adminAuth().getUser(student.uid);
  assert.equal(after.customClaims?.admin, undefined);
  assert.notEqual(after.tokensValidAfterTime, before, 'refresh tokens revoked on removal');
});

test('you cannot remove your own admin role or delete yourself', async () => {
  assert.equal((await call(setRole, 'POST', bossToken, { uid: boss.uid, admin: false })).status, 400);
  assert.equal((await adminAuth().getUser(boss.uid)).customClaims?.admin, true);
  assert.equal((await call(deleteUser, 'POST', bossToken, { uid: boss.uid })).status, 400);
  assert.ok(await adminAuth().getUser(boss.uid));
});

test('bad requests are rejected', async () => {
  assert.equal((await call(setRole, 'POST', bossToken, { uid: student.uid, admin: 'yes' })).status, 400);
  assert.equal((await call(setRole, 'POST', bossToken, { uid: 'no-such-user', admin: true })).status, 404);
  assert.equal((await call(deleteUser, 'POST', bossToken, {})).status, 400);
});

test('deleting a student removes login, profile, notes and relabels their chat', async () => {
  const victim = await makeAccount('leaver');
  const db = adminDb();
  await db.doc(`users/${victim.uid}/notes/n1`).set({ body: 'private' });
  await db.doc(`chatMessages/leaver-${stamp}`).set({ author: 'leaver name', text: 'bye', uid: victim.uid, role: 'member' });

  assert.equal((await call(deleteUser, 'POST', bossToken, { uid: victim.uid })).status, 200);
  await assert.rejects(adminAuth().getUser(victim.uid));
  assert.equal((await db.doc(`users/${victim.uid}`).get()).exists, false);
  assert.equal((await db.doc(`users/${victim.uid}/notes/n1`).get()).exists, false);
  const msg = (await db.doc(`chatMessages/leaver-${stamp}`).get()).data();
  assert.equal(msg?.author, 'Former student');
  assert.equal(msg?.uid, undefined);
  // retrying is harmless
  assert.equal((await call(deleteUser, 'POST', bossToken, { uid: victim.uid })).status, 200);
});
