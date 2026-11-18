// /api/admin/checkin and /api/admin/checkin-remove against the emulators
// (attendance slice 2, criteria 2, 4, 5, 6, 7). Needs: npm run emulators
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb } = await import('../netlify/lib/firebaseAdmin.mts');
const { studioDate, checkinId, guestCheckinId } = await import('../netlify/lib/studio.mts');
const { default: addCheckin } = await import('../netlify/functions/admin-checkin.mts');
const { default: removeCheckin } = await import('../netlify/functions/admin-checkin-remove.mts');
const { default: qrCheckin } = await import('../netlify/functions/checkin.mts');

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const stamp = Date.now();
const PASSWORD = 'admin-checkin-test-pass';

const makeAccount = async (tag: string, opts: { verified?: boolean; admin?: boolean } = {}) => {
  const email = `${tag}-${stamp}@test.dev`;
  const u = await adminAuth().createUser({ email, password: PASSWORD, emailVerified: opts.verified ?? true });
  if (opts.admin) await adminAuth().setCustomUserClaims(u.uid, { admin: true });
  await adminDb().doc(`users/${u.uid}`).set({ displayName: `${tag} name`, createdAt: new Date() });
  return { uid: u.uid, email };
};
const tokenFor = async (email: string) => {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return (await res.json()).idToken as string;
};
const call = (fn: (r: Request) => Promise<Response>, token: string | undefined, body: unknown) =>
  fn(
    new Request('http://localhost/api/x', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

/** n studio days before today, as YYYY-MM-DD. */
const daysAgo = (n: number) => studioDate(new Date(Date.now() - n * 86_400_000));
const today = () => studioDate();

const SLOT = `thu8-${stamp}`;
const ARCHIVED = `gone-${stamp}`;
const GUEST = `g${stamp}`;
let boss: { uid: string; email: string };
let student: { uid: string; email: string };
let bossToken: string;
let studentToken: string;

before(async () => {
  const db = adminDb();
  await db.doc(`slots/${SLOT}`).set({ label: 'Thu 8:00pm', title: 'WCS 101', archived: false, createdAt: new Date() });
  await db.doc(`slots/${ARCHIVED}`).set({ label: 'Old', title: 'Gone', archived: true, createdAt: new Date() });
  await db.doc(`guests/${GUEST}`).set({ name: 'Walk-in Wendy', createdAt: new Date(), createdBy: 'x' });
  boss = await makeAccount('boss', { admin: true });
  student = await makeAccount('stu');
  bossToken = await tokenFor(boss.email);
  studentToken = await tokenFor(student.email);
});

test('only verified, current admins can add or remove', async () => {
  const unverified = await makeAccount('unv-admin', { admin: true, verified: false });
  const body = { slotId: SLOT, date: today(), uid: student.uid };
  for (const fn of [addCheckin, removeCheckin]) {
    assert.equal((await call(fn, undefined, body)).status, 401);
    assert.equal((await call(fn, 'garbage', body)).status, 401);
    assert.equal((await call(fn, studentToken, body)).status, 403);
    assert.equal((await call(fn, await tokenFor(unverified.email), body)).status, 403);
  }
  // A removed admin's still-unexpired token is refused (revocation is checked).
  const exAdmin = await makeAccount('ex-admin', { admin: true });
  const exToken = await tokenFor(exAdmin.email);
  await new Promise(r => setTimeout(r, 1100));
  await adminAuth().setCustomUserClaims(exAdmin.uid, null);
  await adminAuth().revokeRefreshTokens(exAdmin.uid);
  assert.equal((await call(addCheckin, exToken, body)).status, 401);
  const none = await adminDb().collection('checkins').where('slotId', '==', SLOT).get();
  assert.equal(none.size, 0, 'nothing was written');
});

test('an admin checks an account holder in for a past day, with that day\'s title', async () => {
  const date = daysAgo(7);
  const res = await call(addCheckin, bossToken, { slotId: SLOT, date, uid: student.uid });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'checked-in');
  const doc = (await adminDb().doc(`checkins/${checkinId(SLOT, date, student.uid)}`).get()).data();
  assert.equal(doc?.uid, student.uid);
  assert.equal(doc?.name, 'stu name');
  assert.equal(doc?.method, 'manual');
  assert.equal(doc?.addedBy, boss.uid);
  assert.equal(doc?.title, 'WCS 101');
  assert.equal(doc?.date, date);
});

test('a past day keeps the title recorded that day, even after the slot is renamed', async () => {
  const date = daysAgo(7);
  await adminDb().doc(`slots/${SLOT}`).update({ title: 'WCS 201' });
  const res = await call(addCheckin, bossToken, { slotId: SLOT, date, guestId: GUEST });
  assert.equal((await res.json()).title, 'WCS 101');
  // Today has no check-ins yet, so it gets the current title.
  const t = await call(addCheckin, bossToken, { slotId: SLOT, date: today(), guestId: GUEST });
  assert.equal((await t.json()).title, 'WCS 201');
  const g = (await adminDb().doc(`checkins/${guestCheckinId(SLOT, today(), GUEST)}`).get()).data();
  assert.equal(g?.guestId, GUEST);
  assert.equal(g?.uid, undefined);
  assert.equal(g?.name, 'Walk-in Wendy');
});

test('adding someone already checked in (by QR or by hand) is "already", one record', async () => {
  // The student scans the QR today, then an admin adds them too.
  assert.equal((await (await call(qrCheckin, studentToken, { slotId: SLOT })).json()).status, 'checked-in');
  const res = await call(addCheckin, bossToken, { slotId: SLOT, date: today(), uid: student.uid });
  assert.equal((await res.json()).status, 'already');
  // And the guest added earlier today.
  assert.equal((await (await call(addCheckin, bossToken, { slotId: SLOT, date: today(), guestId: GUEST })).json()).status, 'already');
  const mine = await adminDb().collection('checkins').where('uid', '==', student.uid).where('date', '==', today()).get();
  assert.equal(mine.size, 1);
  assert.equal(mine.docs[0].data().method, 'qr');
});

test('future dates, bad dates, archived/unknown slots and unknown people are refused', async () => {
  const tomorrow = studioDate(new Date(Date.now() + 86_400_000));
  const cases: [unknown, number][] = [
    [{ slotId: SLOT, date: tomorrow, uid: student.uid }, 400],
    [{ slotId: SLOT, date: '2026-02-30', uid: student.uid }, 400],
    [{ slotId: SLOT, date: 'yesterday', uid: student.uid }, 400],
    [{ slotId: SLOT, date: today(), uid: student.uid, guestId: GUEST }, 400],
    [{ slotId: SLOT, date: today() }, 400],
    [{ slotId: ARCHIVED, date: today(), uid: student.uid }, 404],
    [{ slotId: `nope-${stamp}`, date: today(), uid: student.uid }, 404],
    [{ slotId: '../users/x', date: today(), uid: student.uid }, 404],
    [{ slotId: SLOT, date: today(), uid: `missing-${stamp}` }, 404],
    [{ slotId: SLOT, date: today(), uid: 'g_lookslikeaguest' }, 400],
    [{ slotId: SLOT, date: today(), guestId: `nobody-${stamp}` }, 404],
  ];
  for (const [body, status] of cases) {
    assert.equal((await call(addCheckin, bossToken, body)).status, status, JSON.stringify(body));
  }
  const archived = await adminDb().collection('checkins').where('slotId', '==', ARCHIVED).get();
  assert.equal(archived.size, 0);
});

test('removing a check-in deletes it; removing again or a bad id is 404', async () => {
  const id = checkinId(SLOT, today(), student.uid);
  const res = await call(removeCheckin, bossToken, { id });
  assert.equal(res.status, 200);
  assert.equal((await adminDb().doc(`checkins/${id}`).get()).exists, false);
  assert.equal((await call(removeCheckin, bossToken, { id })).status, 404);
  assert.equal((await call(removeCheckin, bossToken, { id: 'users/x' })).status, 404);
  assert.equal((await call(removeCheckin, bossToken, { id: 42 })).status, 404);
  // The student can check in again after a mistaken removal.
  assert.equal((await (await call(qrCheckin, studentToken, { slotId: SLOT })).json()).status, 'checked-in');
});
