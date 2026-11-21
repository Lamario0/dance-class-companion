// Class slot display order: POST /api/admin/slot { order } (admins only), and the
// client-side sort. Needs: npm run emulators
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb } = await import('../netlify/lib/firebaseAdmin.mts');
const { setSheetsApiForTests } = await import('../netlify/lib/sheets.mts');
const { default: slotFn } = await import('../netlify/functions/admin-slot.mts');
const { sortSlots } = await import('../services/slotOrder.ts');
setSheetsApiForTests(null);

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const stamp = Date.now();
const PASSWORD = 'slot-order-test-pass';
const makeAccount = async (tag: string, admin = false) => {
  const email = `${tag}-${stamp}@test.dev`;
  const u = await adminAuth().createUser({ email, password: PASSWORD, emailVerified: true });
  if (admin) await adminAuth().setCustomUserClaims(u.uid, { admin: true });
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return (await res.json()).idToken as string;
};
const call = async (token: string, body: unknown) => {
  const res = await slotFn(new Request('http://localhost/api/admin/slot', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

const IDS = ['a', 'b', 'c'].map(x => `ord${x}-${stamp}`);
let adminToken: string;
let studentToken: string;

before(async () => {
  adminToken = await makeAccount('ordboss', true);
  studentToken = await makeAccount('ordstudent');
  for (const [i, id] of IDS.entries()) await adminDb().doc(`slots/${id}`).set({ label: `Mon ${i + 6}:00pm`, title: 'Basics 101-A', archived: false, createdAt: new Date() });
});

test('an admin saves the order; each slot gets its position', async () => {
  const r = await call(adminToken, { order: [IDS[2], IDS[0], IDS[1]] });
  assert.equal(r.status, 200);
  const got = await Promise.all(IDS.map(async id => (await adminDb().doc(`slots/${id}`).get()).data()!.order));
  assert.deepEqual(got, [1, 2, 0]);
});

test('students, bad lists and unknown slots are refused; nothing changes', async () => {
  assert.equal((await call(studentToken, { order: [IDS[0], IDS[1], IDS[2]] })).status, 403);
  assert.equal((await call(adminToken, { order: [] })).status, 400);
  assert.equal((await call(adminToken, { order: [IDS[0], IDS[0]] })).status, 400);
  assert.equal((await call(adminToken, { order: 'abc' })).status, 400);
  assert.equal((await call(adminToken, { order: [IDS[0], 'nope-here'] })).status, 404);
  const got = await Promise.all(IDS.map(async id => (await adminDb().doc(`slots/${id}`).get()).data()!.order));
  assert.deepEqual(got, [1, 2, 0]);
});

test('editing a slot keeps its position', async () => {
  assert.equal((await call(adminToken, { id: IDS[0], title: 'Basics 101-B' })).status, 200);
  assert.equal((await adminDb().doc(`slots/${IDS[0]}`).get()).data()!.order, 1);
});

test('sortSlots: ordered ones first, the rest keep creation order', () => {
  const rows = [{ id: 'new1' }, { id: 'x', order: 1 }, { id: 'new2' }, { id: 'y', order: 0 }];
  assert.deepEqual(sortSlots(rows).map(s => s.id), ['y', 'x', 'new1', 'new2']);
});
