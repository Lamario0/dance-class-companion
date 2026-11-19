// /api/admin/levels against the emulators (attendance slice 5, criteria 5, 5a, 9).
// Needs: npm run emulators
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb } = await import('../netlify/lib/firebaseAdmin.mts');
const { checkinId, guestCheckinId } = await import('../netlify/lib/studio.mts');
const { setSheetsApiForTests } = await import('../netlify/lib/sheets.mts');
const { default: levels } = await import('../netlify/functions/admin-levels.mts');
const { default: addCheckin } = await import('../netlify/functions/admin-checkin.mts');
const { default: guestRename } = await import('../netlify/functions/admin-guest-rename.mts');
setSheetsApiForTests(null);

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const stamp = Date.now();
const PASSWORD = 'admin-levels-test-pass';

const makeAccount = async (tag: string, admin = false) => {
  const email = `${tag}-${stamp}@test.dev`;
  const u = await adminAuth().createUser({ email, password: PASSWORD, emailVerified: true });
  if (admin) await adminAuth().setCustomUserClaims(u.uid, { admin: true });
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
const call = async (fn: (r: Request) => Promise<Response>, token: string, body: unknown) => {
  const res = await fn(new Request('http://localhost/api/x', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

let boss: { uid: string; email: string };
let student: { uid: string; email: string };
let bossToken: string;
let studentToken: string;
const SLOT = `lv-${stamp}`;
const GUEST = `lg${stamp}`;

before(async () => {
  boss = await makeAccount('lvboss', true);
  student = await makeAccount('lvstudent');
  bossToken = await tokenFor(boss.email);
  studentToken = await tokenFor(student.email);
  const db = adminDb();
  await db.doc(`slots/${SLOT}`).set({ label: 'Mon 7:00pm', title: 'Basics 101-A', archived: false, createdAt: new Date() });
  await db.doc(`guests/${GUEST}`).set({ name: 'Walk-in Wendy', createdAt: new Date(), createdBy: boss.uid });
  for (const date of ['2026-10-05', '2026-10-12', '2026-10-19']) {
    await db.doc(`checkins/${guestCheckinId(SLOT, date, GUEST)}`).set({ guestId: GUEST, name: 'Walk-in Wendy', slotId: SLOT, slotLabel: 'Mon 7:00pm', title: 'Basics 101-A', date, method: 'manual', at: new Date(), sheet: 'synced' });
  }
  // The account already has its own check-in on Oct 19: that guest one stays with the guest.
  await db.doc(`checkins/${checkinId(SLOT, '2026-10-19', student.uid)}`).set({ uid: student.uid, name: 'lvstudent name', slotId: SLOT, title: 'Basics 101-A', date: '2026-10-19', method: 'qr', at: new Date() });
});

const stored = async (uid: string) => (await adminDb().doc(`levels/${uid}`).get()).data()?.dances;

test('criterion 5: students are refused every action', async () => {
  for (const body of [
    { action: 'set', uid: student.uid, dance: 'WCS', level: 'ADV' },
    { action: 'cap', uid: student.uid, dance: 'WCS', cap: null },
    { action: 'settings', settings: { basicsClasses: 1, basicsMonths: 0, intermediateClasses: 1, intermediateMonths: 0 } },
    { action: 'link', guestId: GUEST, uid: student.uid },
  ]) assert.equal((await call(levels, studentToken, body)).status, 403, body.action);
  assert.equal(await stored(student.uid), undefined);
});

test('5a: an admin promotes straight to any level, and a cap refuses promotions above it', async () => {
  let r = await call(levels, bossToken, { action: 'set', uid: student.uid, dance: 'WCS', level: 'ADV' });
  assert.equal(r.status, 200);
  assert.equal((await stored(student.uid)).WCS.level, 'ADV');
  // A cap below their level is refused until they are moved down.
  r = await call(levels, bossToken, { action: 'cap', uid: student.uid, dance: 'WCS', cap: '200' });
  assert.equal(r.status, 409);
  assert.equal((await call(levels, bossToken, { action: 'set', uid: student.uid, dance: 'WCS', level: '100' })).status, 200);
  assert.equal((await call(levels, bossToken, { action: 'cap', uid: student.uid, dance: 'WCS', cap: '200' })).status, 200);
  r = await call(levels, bossToken, { action: 'set', uid: student.uid, dance: 'WCS', level: 'ADV' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /maximum level/);
  assert.equal((await call(levels, bossToken, { action: 'set', uid: student.uid, dance: 'WCS', level: '200' })).status, 200);
  assert.deepEqual(((d) => ({ level: d.level, cap: d.cap }))((await stored(student.uid)).WCS), { level: '200', cap: '200' });
  // Clearing the cap allows it again; other dances are separate.
  assert.equal((await call(levels, bossToken, { action: 'cap', uid: student.uid, dance: 'WCS', cap: null })).status, 200);
  assert.equal((await call(levels, bossToken, { action: 'set', uid: student.uid, dance: 'WCS', level: 'ADV' })).status, 200);
  assert.equal((await call(levels, bossToken, { action: 'set', uid: student.uid, dance: 'Carolina Shag', level: '200' })).status, 200);
  const d = await stored(student.uid);
  assert.deepEqual([d.WCS.level, d.WCS.cap, d['Carolina Shag'].level], ['ADV', null, '200']);
});

test('bad input is refused', async () => {
  assert.equal((await call(levels, bossToken, { action: 'set', uid: student.uid, dance: 'WCS', level: '300' })).status, 400);
  assert.equal((await call(levels, bossToken, { action: 'set', uid: student.uid, dance: 'a.b', level: '200' })).status, 400);
  assert.equal((await call(levels, bossToken, { action: 'set', uid: 'nobody-here', dance: 'WCS', level: '200' })).status, 404);
  assert.equal((await call(levels, bossToken, { action: 'settings', settings: { basicsClasses: 12 } })).status, 400);
  assert.equal((await call(levels, bossToken, { action: 'nope' })).status, 400);
});

test('criterion 4 (settings): an admin saves the targets', async () => {
  const settings = { basicsClasses: 10, basicsMonths: 3, intermediateClasses: 30, intermediateMonths: 6 };
  assert.equal((await call(levels, bossToken, { action: 'settings', settings })).status, 200);
  const saved = (await adminDb().doc('settings/levels').get()).data()!;
  assert.deepEqual({ ...saved, updatedAt: undefined }, { ...settings, updatedAt: undefined });
});

test('criterion 9: linking moves a guest\'s check-ins to the account; unlinking restores them', async () => {
  const db = adminDb();
  let r = await call(levels, bossToken, { action: 'link', guestId: GUEST, uid: student.uid });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.moved, r.body.skipped], [2, 1]);
  const mine = (await db.collection('checkins').where('uid', '==', student.uid).get()).docs.map(d => d.data());
  assert.equal(mine.length, 3);
  const moved = mine.filter(c => c.linkedGuestId === GUEST);
  assert.equal(moved.length, 2);
  for (const c of moved) assert.deepEqual([c.name, c.guestId, c.sheet], ['lvstudent name', undefined, 'pending']);
  assert.equal((await db.doc(`guests/${GUEST}`).get()).data()!.linkedUid, student.uid);
  // While linked: no second link, no guest check-in, no guest rename of the moved rows.
  assert.equal((await call(levels, bossToken, { action: 'link', guestId: GUEST, uid: boss.uid })).status, 409);
  assert.equal((await call(addCheckin, bossToken, { slotId: SLOT, date: '2026-11-02', guestId: GUEST })).status, 409);
  await db.doc(`guests/${GUEST}`).update({ name: 'Wendy Renamed' });
  assert.equal((await call(guestRename, bossToken, { guestId: GUEST })).body.changed, 0);
  assert.equal(moved[0].name, 'lvstudent name');

  r = await call(levels, bossToken, { action: 'unlink', guestId: GUEST });
  assert.equal(r.status, 200);
  assert.equal(r.body.moved, 2);
  const back = (await db.collection('checkins').where('guestId', '==', GUEST).get()).docs.map(d => d.data());
  assert.equal(back.length, 3);
  for (const c of back) assert.deepEqual([c.uid, c.linkedGuestId], [undefined, undefined]);
  assert.equal(back.filter(c => c.name === 'Wendy Renamed').length, 2);
  assert.equal((await db.collection('checkins').where('uid', '==', student.uid).get()).size, 1);
  assert.equal((await db.doc(`guests/${GUEST}`).get()).data()!.linkedUid, undefined);
  assert.equal((await call(levels, bossToken, { action: 'unlink', guestId: GUEST })).status, 409);
});

test('criterion 8: a check-in to a class above the student\'s level still succeeds (and is flagged)', async () => {
  const { aboveLevel } = await import('../services/levels.ts');
  const db = adminDb();
  const low = await makeAccount('lvlow');
  const INT = `lvint-${stamp}`;
  await db.doc(`slots/${INT}`).set({ label: 'Mon 8:00pm', title: 'Intermediate 201-A', archived: false, createdAt: new Date() });
  const r = await call(addCheckin, bossToken, { slotId: INT, date: '2026-11-03', uid: low.uid });
  assert.equal(r.status, 200);
  const c = (await db.doc(`checkins/${checkinId(INT, '2026-11-03', low.uid)}`).get()).data()!;
  const lv = (await db.doc(`levels/${low.uid}`).get()).data()?.dances?.WCS;
  assert.equal(aboveLevel(c.title, lv), true);
});

test('deleting a linked account gives the guest its check-ins back', async () => {
  const { deleteAccountData } = await import('../netlify/lib/accounts.mts');
  const db = adminDb();
  const gone = await makeAccount('lvgone');
  const G = `lgd${stamp}`;
  await db.doc(`guests/${G}`).set({ name: 'Drop-in Dana', createdAt: new Date(), createdBy: boss.uid });
  await db.doc(`checkins/${guestCheckinId(SLOT, '2026-10-06', G)}`).set({ guestId: G, name: 'Drop-in Dana', slotId: SLOT, title: 'Basics 101-A', date: '2026-10-06', method: 'manual', at: new Date() });
  assert.equal((await call(levels, bossToken, { action: 'link', guestId: G, uid: gone.uid })).body.moved, 1);
  await deleteAccountData(gone.uid);
  const c = (await db.doc(`checkins/${guestCheckinId(SLOT, '2026-10-06', G)}`).get()).data()!;
  assert.deepEqual([c.guestId, c.name, c.uid, c.linkedGuestId], [G, 'Drop-in Dana', undefined, undefined]);
  assert.equal((await db.doc(`guests/${G}`).get()).data()!.linkedUid, undefined);
});
