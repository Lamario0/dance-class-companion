// /api/delete-account against the emulators (spec slice 1, criterion 8). Needs: npm run emulators
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb, adminConfigured } = await import('../netlify/lib/firebaseAdmin.mts');

test('emulator mode never switches on inside Netlify, even with emulator vars set', () => {
  assert.equal(adminConfigured(), true); // local opt-in + emulator hosts
  for (const v of ['NETLIFY', 'AWS_LAMBDA_FUNCTION_NAME', 'CONTEXT']) {
    process.env[v] = 'true';
    assert.equal(adminConfigured(), false, `${v} should disable emulator mode`);
    delete process.env[v];
  }
  delete process.env.DCC_USE_EMULATORS;
  assert.equal(adminConfigured(), false, 'emulator hosts alone must not enable it');
  process.env.DCC_USE_EMULATORS = '1';
});
const { default: deleteAccount } = await import('../netlify/functions/delete-account.mts');

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

/** Create an email user in the Auth emulator and return its uid + ID token. */
const makeUser = async (email: string) => {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-1', returnSecureToken: true }),
  });
  const body = await res.json();
  assert.ok(body.idToken, `sign-up failed: ${JSON.stringify(body)}`);
  return { uid: body.localId as string, idToken: body.idToken as string };
};

const call = (token?: string) =>
  deleteAccount(
    new Request('http://localhost/api/delete-account', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
    {} as any,
  );

before(async () => {
  // fresh emulator state for these accounts
  for (const email of ['del-me@test.dev', 'keep-me@test.dev']) {
    try {
      await adminAuth().deleteUser((await adminAuth().getUserByEmail(email)).uid);
    } catch { /* not there */ }
  }
});

test('rejects a request without a signed-in user', async () => {
  assert.equal((await call()).status, 401);
  assert.equal((await call('not-a-token')).status, 401);
});

test('deletes the login, the profile and everything under it, and nothing else', async () => {
  const me = await makeUser('del-me@test.dev');
  const other = await makeUser('keep-me@test.dev');
  const db = adminDb();
  await db.doc(`users/${me.uid}`).set({ displayName: 'Del', createdAt: new Date() });
  await db.doc(`users/${me.uid}/notes/n1`).set({ text: 'my note' });
  await db.doc(`users/${other.uid}`).set({ displayName: 'Keep', createdAt: new Date() });
  await db.doc('chatMessages/fromDel').set({ author: 'Del', text: 'see you Thursday', uid: me.uid, role: 'member' });
  await db.doc('chatMessages/fromKeep').set({ author: 'Keep', text: 'me too', uid: other.uid, role: 'member' });

  const res = await call(me.idToken);
  assert.equal(res.status, 200);

  await assert.rejects(adminAuth().getUser(me.uid), /no user record|user-not-found/i);
  assert.equal((await db.doc(`users/${me.uid}`).get()).exists, false);
  assert.equal((await db.doc(`users/${me.uid}/notes/n1`).get()).exists, false);

  // their chat messages stay, relabelled and no longer linked to the account
  const msg = (await db.doc(`chatMessages/fromDel`).get()).data();
  assert.equal(msg?.author, 'Former student');
  assert.equal(msg?.uid, undefined);
  assert.equal(msg?.role, undefined);
  assert.equal(msg?.text, 'see you Thursday');
  assert.equal((await db.doc('chatMessages/fromKeep').get()).data()?.author, 'Keep');

  // the other student is untouched
  assert.equal((await adminAuth().getUser(other.uid)).email, 'keep-me@test.dev');
  assert.equal((await db.doc(`users/${other.uid}`).get()).exists, true);

  // and the deleted credentials no longer sign in
  const again = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'del-me@test.dev', password: 'correct-horse-1', returnSecureToken: true }),
  });
  assert.equal(again.ok, false);
});
