// /api/checkin against the emulators (attendance slice 1, criteria 3, 5, 6, 7). Needs: npm run emulators
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb } = await import('../netlify/lib/firebaseAdmin.mts');
const { studioDate, checkinId } = await import('../netlify/lib/studio.mts');
const { default: checkin } = await import('../netlify/functions/checkin.mts');

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const stamp = Date.now();
const PASSWORD = 'checkin-test-pass';

const account = async (tag: string, verified = true) => {
  const email = `${tag}-${stamp}@test.dev`;
  const u = await adminAuth().createUser({ email, password: PASSWORD, emailVerified: verified });
  await adminDb().doc(`users/${u.uid}`).set({ displayName: `${tag} name`, createdAt: new Date() });
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return { uid: u.uid, token: (await res.json()).idToken as string };
};

const call = (token: string | undefined, slotId: unknown) =>
  checkin(
    new Request('http://localhost/api/checkin', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId }),
    }),
  );

const SLOT = `tue7-${stamp}`;
const ARCHIVED = `old-${stamp}`;
let student: { uid: string; token: string };

before(async () => {
  const db = adminDb();
  await db.doc(`slots/${SLOT}`).set({ label: 'Tue 7:00pm', title: 'WCS 201', archived: false, createdAt: new Date() });
  await db.doc(`slots/${ARCHIVED}`).set({ label: 'Old', title: 'Gone', archived: true, createdAt: new Date() });
  student = await account('stu');
});

test('the studio day is the Grand Rapids date, not UTC or the phone', () => {
  // EST (UTC-5) in November
  assert.equal(studioDate(new Date('2026-11-18T04:30:00Z')), '2026-11-17'); // 11:30pm Nov 17 local
  assert.equal(studioDate(new Date('2026-11-18T05:30:00Z')), '2026-11-18'); // 12:30am Nov 18 local
  assert.equal(studioDate(new Date('2026-11-18T04:00:00Z')), studioDate(new Date('2026-11-18T04:30:00Z'))); // 11pm & 11:30pm same day
  // EDT (UTC-4) in summer
  assert.equal(studioDate(new Date('2026-07-01T03:59:00Z')), '2026-06-30');
  assert.equal(studioDate(new Date('2026-07-01T04:00:00Z')), '2026-07-01');
});

test('a verified student is checked in, with the slot title and label snapshotted', async () => {
  const res = await call(student.token, SLOT);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'checked-in');
  assert.equal(body.title, 'WCS 201');
  assert.equal(body.label, 'Tue 7:00pm');
  const doc = (await adminDb().doc(`checkins/${checkinId(SLOT, studioDate(), student.uid)}`).get()).data();
  assert.equal(doc?.uid, student.uid);
  assert.equal(doc?.name, 'stu name');
  assert.equal(doc?.title, 'WCS 201');
  assert.equal(doc?.method, 'qr');
});

test('a second scan the same studio day is "already", with no second record', async () => {
  const res = await call(student.token, SLOT);
  assert.equal((await res.json()).status, 'already');
  const all = await adminDb().collection('checkins').where('uid', '==', student.uid).where('slotId', '==', SLOT).get();
  assert.equal(all.size, 1);
});

test('a title edit later does not rewrite the check-in', async () => {
  await adminDb().doc(`slots/${SLOT}`).update({ title: 'WCS 301' });
  const doc = (await adminDb().doc(`checkins/${checkinId(SLOT, studioDate(), student.uid)}`).get()).data();
  assert.equal(doc?.title, 'WCS 201');
});

test('unknown or archived slots are "not active" and write nothing', async () => {
  await adminDb().doc(`slots/broken-${stamp}`).set({ label: 'No title', archived: false, createdAt: new Date() });
  for (const id of [`nope-${stamp}`, ARCHIVED, `broken-${stamp}`, '../users/x', 42]) {
    const res = await call(student.token, id);
    assert.equal(res.status, 404, String(id));
    assert.equal((await res.json()).code, 'inactive');
  }
  const archivedCheckins = await adminDb().collection('checkins').where('slotId', '==', ARCHIVED).get();
  assert.equal(archivedCheckins.size, 0);
});

test('no token -> 401; unverified email -> 403 "unverified"', async () => {
  assert.equal((await call(undefined, SLOT)).status, 401);
  assert.equal((await call('garbage', SLOT)).status, 401);
  const unv = await account('unv', false);
  const res = await call(unv.token, SLOT);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'unverified');
});
