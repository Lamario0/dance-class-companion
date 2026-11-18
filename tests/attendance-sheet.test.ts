// Slice 3B: check-ins -> the Attendance worksheet. In-memory workbook, never Google.
// Needs: npm run emulators
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb } = await import('../netlify/lib/firebaseAdmin.mts');
const { setSheetsApiForTests, resetSheetDown } = await import('../netlify/lib/sheets.mts');
const { syncSheet } = await import('../netlify/lib/sheetSync.mts');
const { deleteAccountData } = await import('../netlify/lib/accounts.mts');
const { studioDate, checkinId, guestCheckinId } = await import('../netlify/lib/studio.mts');
const { default: qrCheckin } = await import('../netlify/functions/checkin.mts');
const { default: addCheckin } = await import('../netlify/functions/admin-checkin.mts');
const { default: removeCheckin } = await import('../netlify/functions/admin-checkin-remove.mts');
const { default: renameMe } = await import('../netlify/functions/attendance-rename.mts');
const { default: renameGuest } = await import('../netlify/functions/admin-guest-rename.mts');
const { FakeBook } = await import('./fakeBook.ts');

const book = new FakeBook();
book.grid('Slots')[0] = ['Slot', 'Class', 'Archived', 'Slot ID'];
book.grid('Classes')[0] = ['Dance', 'Class', 'Patterns covered', 'Notes', 'Column'];
book.grid('Attendance')[0] = ['Date', 'Time', 'Slot', 'Class', 'Name', 'How', 'Guest', 'Check-in ID'];
setSheetsApiForTests(book);
after(() => setSheetsApiForTests(undefined));

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const stamp = Date.now();
const PASSWORD = 'attendance-sheet-pass';
const makeAccount = async (tag: string, admin = false) => {
  const email = `${tag}-${stamp}@test.dev`;
  const u = await adminAuth().createUser({ email, password: PASSWORD, emailVerified: true });
  if (admin) await adminAuth().setCustomUserClaims(u.uid, { admin: true });
  await adminDb().doc(`users/${u.uid}`).set({ displayName: `${tag} name`, createdAt: new Date() });
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return { uid: u.uid, token: (await res.json()).idToken as string };
};
const call = async (fn: (r: Request) => Promise<Response>, token: string | undefined, body: unknown = {}) => {
  const res = await fn(
    new Request('http://localhost/api/x', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
};

const serial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return String(Date.UTC(y, m - 1, d) / 86_400_000 + 25_569);
};
const daysAgo = (n: number) => studioDate(new Date(Date.now() - n * 86_400_000));
const today = () => studioDate();
const rowOf = (id: string) => book.attendance().filter(r => r[7] === id);
/** Push back when a check-in's row write started, so the job takes it (it leaves very fresh ones). */
const backdate = (id: string) => adminDb().doc(`checkins/${id}`).update({ sheetAt: new Date(Date.now() - 10 * 60_000) });
const noOutage = () => {
  book.failing = false;
  book.delayMs = 0;
  resetSheetDown();
};

const SLOT = `att-${stamp}`;
const SLOT2 = `att2-${stamp}`;
let boss: { uid: string; token: string };
let ann: { uid: string; token: string };
let ben: { uid: string; token: string };
let cara: { uid: string; token: string };

before(async () => {
  const db = adminDb();
  await db.doc(`slots/${SLOT}`).set({ label: 'Tue 7:00pm', title: 'Basics 101-A', archived: false, createdAt: new Date() });
  await db.doc(`slots/${SLOT2}`).set({ label: 'Wed 8:00pm', title: 'Musicality', archived: false, createdAt: new Date() });
  await db.doc('sheetSync/attendance').set({ backfilled: true }); // the backfill test turns it off
  boss = await makeAccount('attboss', true);
  ann = await makeAccount('ann');
  ben = await makeAccount('ben');
  cara = await makeAccount('cara');
});

test('a QR check-in and an admin-added guest each add exactly one row with the agreed columns', async () => {
  const r = await call(qrCheckin, ann.token, { slotId: SLOT });
  assert.equal(r.body.status, 'checked-in');
  const id = checkinId(SLOT, today(), ann.uid);
  const [row, ...extra] = rowOf(id);
  assert.equal(extra.length, 0);
  assert.equal(row[0], serial(today()));
  assert.ok(Number(row[1]) >= 0 && Number(row[1]) < 1, 'QR time is a time of day');
  assert.deepEqual(row.slice(2), ['Tue 7:00pm', 'Basics 101-A', 'ann name', 'QR', '', id]);
  assert.equal((await adminDb().doc(`checkins/${id}`).get()).data()!.sheet, 'synced');

  // Scanning again the same day: no second row.
  await call(qrCheckin, ann.token, { slotId: SLOT });
  assert.equal(rowOf(id).length, 1);

  await adminDb().doc(`guests/g${stamp}`).set({ name: 'Gus', createdAt: new Date(), createdBy: boss.uid });
  const g = await call(addCheckin, boss.token, { slotId: SLOT, date: today(), guestId: `g${stamp}` });
  assert.equal(g.body.status, 'checked-in');
  const gid = guestCheckinId(SLOT, today(), `g${stamp}`);
  assert.deepEqual(rowOf(gid)[0].slice(1), ['', 'Tue 7:00pm', 'Basics 101-A', 'Gus', 'Added', 'yes', gid]);
});

test('rows read newest day first, including past-day adds', async () => {
  await call(addCheckin, boss.token, { slotId: SLOT, date: daysAgo(7), uid: ben.uid });
  await call(addCheckin, boss.token, { slotId: SLOT, date: daysAgo(3), uid: ben.uid });
  await call(addCheckin, boss.token, { slotId: SLOT2, date: today(), uid: ben.uid });
  const dates = book.attendance().map(r => Number(r[0]));
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a), 'newest day first');
  const order = book.attendance().map(r => r[7]);
  assert.ok(order.indexOf(checkinId(SLOT, daysAgo(3), ben.uid)) < order.indexOf(checkinId(SLOT, daysAgo(7), ben.uid)));
  assert.ok(order.indexOf(checkinId(SLOT2, today(), ben.uid)) < order.indexOf(checkinId(SLOT, daysAgo(3), ben.uid)));
});

test('removing a check-in deletes its row only, even after the sheet was sorted by hand', async () => {
  const g = book.grid('Attendance');
  g.splice(1, g.length - 1, ...g.slice(1).reverse()); // someone sorted oldest first
  g.push(['', '', '', '', 'Typed by hand', '', '', '']); // a row without an id
  const before = book.attendance().length;
  const id = checkinId(SLOT, daysAgo(3), ben.uid);
  assert.equal((await call(removeCheckin, boss.token, { id })).body.status, 'removed');
  assert.equal(rowOf(id).length, 0);
  assert.equal(book.attendance().length, before - 1);
  assert.ok(book.attendance().some(r => r[4] === 'Typed by hand'));
});

test('sheet down: check-ins and removals still succeed; the job catches up without duplicates', async () => {
  book.failing = true;
  const r = await call(qrCheckin, cara.token, { slotId: SLOT });
  assert.equal(r.body.status, 'checked-in');
  const id = checkinId(SLOT, today(), cara.uid);
  assert.equal((await adminDb().doc(`checkins/${id}`).get()).data()!.sheet, 'pending');
  const gone = checkinId(SLOT, daysAgo(7), ben.uid);
  assert.equal((await call(removeCheckin, boss.token, { id: gone })).body.status, 'removed');
  assert.ok((await adminDb().doc(`sheetDeletes/${gone}`).get()).exists);
  noOutage();

  await backdate(id);
  const s = await syncSheet(book, adminDb());
  assert.ok(s.attendance.written >= 1);
  assert.equal(rowOf(id).length, 1);
  assert.equal(rowOf(gone).length, 0);
  assert.equal((await adminDb().doc(`sheetDeletes/${gone}`).get()).exists, false);
  assert.equal((await adminDb().doc(`checkins/${id}`).get()).data()!.sheet, 'synced');
  const count = book.attendance().length;
  await syncSheet(book, adminDb());
  assert.equal(book.attendance().length, count, 'a second run adds nothing');
});

test('removed then checked in again before the job ran: the row stays', async () => {
  const id = checkinId(SLOT2, today(), cara.uid);
  await call(addCheckin, boss.token, { slotId: SLOT2, date: today(), uid: cara.uid });
  book.failing = true;
  await call(removeCheckin, boss.token, { id });
  noOutage();
  await call(addCheckin, boss.token, { slotId: SLOT2, date: today(), uid: cara.uid });
  await syncSheet(book, adminDb());
  assert.equal(rowOf(id).length, 1);
});

test('first run writes every earlier check-in once, in its day; twice adds nothing', async () => {
  const db = adminDb();
  const old1 = `${SLOT}__2025-03-04__old1-${stamp}`;
  const old2 = `${SLOT}__2025-03-02__old2-${stamp}`;
  await db.doc(`checkins/${old1}`).set({ uid: `old1-${stamp}`, name: 'Old One', slotId: SLOT, slotLabel: 'Tue 7:00pm', title: 'WCS 201', date: '2025-03-04', at: new Date('2025-03-04T23:00:00Z'), method: 'qr' });
  await db.doc(`checkins/${old2}`).set({ uid: `old2-${stamp}`, name: 'Old Two', slotId: SLOT, slotLabel: 'Tue 7:00pm', title: 'WCS 201', date: '2025-03-02', at: new Date('2025-03-02T23:00:00Z'), method: 'qr' });
  await db.doc('sheetSync/attendance').delete();
  await syncSheet(book, db);
  assert.equal(rowOf(old1).length, 1);
  assert.equal(rowOf(old2).length, 1);
  assert.equal(rowOf(checkinId(SLOT, today(), ann.uid)).length, 1, 'rows already there are not doubled');
  const order = book.attendance().map(r => r[7]);
  assert.ok(order.indexOf(old1) < order.indexOf(old2));
  assert.ok(order.indexOf(checkinId(SLOT, today(), ann.uid)) < order.indexOf(old1));
  const count = book.attendance().length;
  await syncSheet(book, db);
  assert.equal(book.attendance().length, count);
});

test('renames: a student or a guest; the name comes from the saved record; sheet down catches up', async () => {
  await adminDb().doc(`users/${ann.uid}`).update({ displayName: 'Annie' });
  assert.equal((await call(renameMe, undefined)).status, 401);
  const r = await call(renameMe, ann.token, { name: 'Hacked' });
  assert.equal(r.status, 200);
  const id = checkinId(SLOT, today(), ann.uid);
  assert.equal(rowOf(id)[0][4], 'Annie');
  assert.equal((await adminDb().doc(`checkins/${id}`).get()).data()!.name, 'Annie');

  await adminDb().doc(`guests/g${stamp}`).update({ name: 'Gus K.' });
  assert.equal((await call(renameGuest, ann.token, { guestId: `g${stamp}` })).status, 403);
  assert.equal((await call(renameGuest, boss.token, { guestId: `g${stamp}` })).body.changed, 1);
  assert.equal(rowOf(guestCheckinId(SLOT, today(), `g${stamp}`))[0][4], 'Gus K.');

  // Sheet down during a rename: the app has the new name now, the sheet after the job.
  await adminDb().doc(`users/${ann.uid}`).update({ displayName: 'Ann Lee' });
  book.failing = true;
  await call(renameMe, ann.token);
  noOutage();
  assert.equal((await adminDb().doc(`checkins/${id}`).get()).data()!.name, 'Ann Lee');
  assert.equal(rowOf(id)[0][4], 'Annie');
  await backdate(id);
  await syncSheet(book, adminDb());
  assert.equal(rowOf(id)[0][4], 'Ann Lee');
  assert.equal(rowOf(id).length, 1);
});

test('a deleted account\'s check-ins stay as "Former student" with no account link', async () => {
  const id = checkinId(SLOT, daysAgo(7), ben.uid);
  await call(addCheckin, boss.token, { slotId: SLOT, date: daysAgo(7), uid: ben.uid });
  const before = (await adminDb().collection('checkins').where('slotId', '==', SLOT).get()).size;
  await deleteAccountData(ben.uid);
  await backdate(id);
  const d = (await adminDb().doc(`checkins/${id}`).get()).data()!;
  assert.equal(d.name, 'Former student');
  assert.equal(d.uid, undefined);
  assert.equal((await adminDb().collection('checkins').where('slotId', '==', SLOT).get()).size, before, 'headcount unchanged');
  await syncSheet(book, adminDb());
  assert.equal(rowOf(id)[0][4], 'Former student');
});

test('a slow sheet never holds a QR check-in past ~4 s', async () => {
  for (const delay of [1000, 3000]) {
    noOutage();
    book.delayMs = delay;
    const who = await makeAccount(`slow${delay}`);
    const t0 = Date.now();
    const r = await call(qrCheckin, who.token, { slotId: SLOT2 });
    const took = Date.now() - t0;
    assert.equal(r.body.status, 'checked-in');
    assert.ok(took < 4500, `took ${took} ms with a ${delay} ms sheet`);
  }
  noOutage();
});
