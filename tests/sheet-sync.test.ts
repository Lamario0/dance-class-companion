// Slice 3A: slots <-> the Slots worksheet, check-ins read the sheet, Classes refresh.
// Uses an in-memory workbook (never Google). Needs: npm run emulators
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb } = await import('../netlify/lib/firebaseAdmin.mts');
const { setSheetsApiForTests, colLetter } = await import('../netlify/lib/sheets.mts');
const { syncSheet, refreshClasses, classRow } = await import('../netlify/lib/sheetSync.mts');
const { default: saveSlot } = await import('../netlify/functions/admin-slot.mts');
const { default: sheetSync } = await import('../netlify/functions/admin-sheet-sync.mts');
const { default: qrCheckin } = await import('../netlify/functions/checkin.mts');
const { default: addCheckin } = await import('../netlify/functions/admin-checkin.mts');
type SheetsApi = import('../netlify/lib/sheets.mts').SheetsApi;

// --- an in-memory workbook -------------------------------------------------------
const colIndex = (l: string) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
class FakeBook implements SheetsApi {
  grids = new Map<string, string[][]>();
  row1 = new Map<string, { text: string; checkbox: boolean }[]>();
  failing = false;
  writes = 0;
  rawWrites = 0;
  grid(name: string) {
    if (!this.grids.has(name)) this.grids.set(name, []);
    return this.grids.get(name)!;
  }
  private parse(range: string) {
    const m = /^(?:'((?:[^']|'')+)'|([^!]+))!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range)!;
    return { sheet: (m[1] ?? m[2]).replace(/''/g, "'"), c0: colIndex(m[3]), r0: m[4] ? +m[4] - 1 : 0, c1: colIndex(m[5] ?? m[3]), r1: m[6] ? +m[6] - 1 : Infinity };
  }
  private check() {
    if (this.failing) throw new Error('sheet down');
  }
  async get(range: string, formulas = false) {
    this.check();
    const { sheet, c0, r0, c1, r1 } = this.parse(range);
    const g = this.grid(sheet);
    const out: string[][] = [];
    for (let r = r0; r < Math.min(g.length, r1 + 1); r++) {
      const row = (g[r] ?? []).slice(c0, c1 + 1).map(v => (!formulas && v.startsWith('=') ? '(computed)' : v));
      out.push(row);
    }
    return out;
  }
  async update(range: string, rows: (string | boolean)[][], asText = false) {
    this.check();
    this.writes++;
    if (asText) this.rawWrites++;
    const { sheet, c0, r0 } = this.parse(range);
    const g = this.grid(sheet);
    rows.forEach((row, i) => {
      g[r0 + i] = g[r0 + i] ?? [];
      row.forEach((v, j) => (g[r0 + i][c0 + j] = String(v)));
    });
  }
  async append(range: string, rows: (string | boolean)[][], asText = false) {
    this.check();
    this.writes++;
    if (asText) this.rawWrites++;
    const { sheet } = this.parse(range);
    const g = this.grid(sheet);
    let last = g.length;
    while (last > 0 && !(g[last - 1] ?? []).some(Boolean)) last--;
    rows.forEach((row, i) => (g[last + i] = row.map(String)));
  }
  async meta() {
    this.check();
    const titles = new Set([...this.grids.keys(), ...this.row1.keys()]);
    return [...titles].map(title => ({ title, row1: this.row1.get(title) ?? [] }));
  }
  slotRow(id: string) {
    return this.grid('Slots').find(r => r[3] === id);
  }
}

const book = new FakeBook();
book.grid('Slots')[0] = ['Slot', 'Class', 'Archived', 'Slot ID'];
book.grid('Classes')[0] = ['Dance', 'Class', 'Patterns covered', 'Notes', 'Column'];
setSheetsApiForTests(book);
after(() => setSheetsApiForTests(undefined));

// --- accounts ---------------------------------------------------------------------
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const stamp = Date.now();
const PASSWORD = 'sheet-sync-test-pass';
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

let boss: { uid: string; token: string };
let student: { uid: string; token: string };
before(async () => {
  boss = await makeAccount('sheetboss', true);
  student = await makeAccount('sheetstudent');
});

test('creating and editing a slot writes its Slots row; only admins; text checked', async () => {
  assert.equal((await call(saveSlot, student.token, { label: 'Tue 7:00pm', title: 'Basics 101-A' })).status, 403);
  assert.equal((await call(saveSlot, undefined, { label: 'Tue 7:00pm', title: 'Basics 101-A' })).status, 401);
  assert.equal((await call(saveSlot, boss.token, { label: 'x'.repeat(61), title: 'Basics 101-A' })).status, 400);
  assert.equal((await call(saveSlot, boss.token, { label: '  ', title: 'Basics 101-A' })).status, 400);
  assert.equal((await call(saveSlot, boss.token, { id: 'nope-nope', title: 'Basics 101-A' })).status, 404);

  const made = await call(saveSlot, boss.token, { label: 'Tue 7:00pm', title: 'Basics 101-A' });
  assert.equal(made.status, 200);
  assert.equal(made.body.synced, true);
  const id = made.body.slot.id as string;
  assert.deepEqual(book.slotRow(id), ['Tue 7:00pm', 'Basics 101-A', '', id]);
  const doc = (await adminDb().doc(`slots/${id}`).get()).data()!;
  assert.equal(doc.sheetPending, false);
  assert.equal(doc.archived, false);

  const rowsBefore = book.grid('Slots').length;
  await call(saveSlot, boss.token, { id, title: 'Basics 101-B' });
  await call(saveSlot, boss.token, { id, archived: true });
  assert.deepEqual(book.slotRow(id), ['Tue 7:00pm', 'Basics 101-B', 'yes', id]);
  assert.equal(book.grid('Slots').length, rowsBefore, 'edits update the row, never add one');

  // Slots rows are written as plain text (RAW), never as formulas or dates.
  const f = await call(saveSlot, boss.token, { label: '=1+1', title: 'Basics 101-A' });
  assert.equal(book.slotRow(f.body.slot.id)![0], '=1+1');
  assert.ok(book.rawWrites > 0);
});

test('sheet down: the slot still saves, and the job writes it later (no duplicate row)', async () => {
  book.failing = true;
  const made = await call(saveSlot, boss.token, { label: 'Wed 8:00pm', title: 'Intermediate 201-C' });
  assert.equal(made.status, 200);
  assert.equal(made.body.synced, false);
  const id = made.body.slot.id as string;
  assert.equal((await adminDb().doc(`slots/${id}`).get()).data()!.sheetPending, true);
  assert.equal((await call(sheetSync, boss.token)).status, 502);
  book.failing = false;

  assert.equal((await call(sheetSync, student.token)).status, 403);
  const r = await call(sheetSync, boss.token);
  assert.equal(r.status, 200);
  assert.deepEqual(book.slotRow(id), ['Wed 8:00pm', 'Intermediate 201-C', '', id]);
  assert.equal((await adminDb().doc(`slots/${id}`).get()).data()!.sheetPending, false);
  await call(sheetSync, boss.token);
  assert.equal(book.grid('Slots').filter(row => row[3] === id).length, 1);
});

test('slots made before 3A get a row on the first sync', async () => {
  const ref = await adminDb().collection('slots').add({ label: 'Mon 6:00pm', title: 'Old title', archived: false, createdAt: new Date() });
  await syncSheet(book, adminDb());
  assert.deepEqual(book.slotRow(ref.id), ['Mon 6:00pm', 'Old title', '', ref.id]);
  const writes = book.writes;
  await syncSheet(book, adminDb());
  assert.equal(book.writes - writes, 0, 'nothing left to write');
});

test('edits made in the Slots worksheet win; Archived stays the app\'s', async () => {
  const made = await call(saveSlot, boss.token, { label: 'Thu 7:00pm', title: 'Intermediate 201-A' });
  const id = made.body.slot.id as string;
  const row = book.slotRow(id)!;
  row[0] = 'Thu 7:30pm';
  row[1] = 'Intermediate 201-D';
  row[2] = 'yes'; // archiving happens in the app, not the sheet
  await syncSheet(book, adminDb());
  const d = (await adminDb().doc(`slots/${id}`).get()).data()!;
  assert.equal(d.label, 'Thu 7:30pm');
  assert.equal(d.title, 'Intermediate 201-D');
  assert.equal(d.archived, false);
  assert.deepEqual(book.slotRow(id), ['Thu 7:30pm', 'Intermediate 201-D', '', id]);

  // Archiving in the app right after a sheet edit keeps the sheet edit.
  book.slotRow(id)![1] = 'Intermediate 201-E';
  const arch = await call(saveSlot, boss.token, { id, archived: true });
  assert.equal(arch.body.slot.title, 'Intermediate 201-E');
  assert.deepEqual(book.slotRow(id), ['Thu 7:30pm', 'Intermediate 201-E', 'yes', id]);
  await call(saveSlot, boss.token, { id, archived: false });
  book.slotRow(id)![1] = 'Intermediate 201-D';

  // A repeated id: the first row counts.
  book.grid('Slots').push(['Other', 'Ignored', '', id]);
  await syncSheet(book, adminDb());
  assert.equal((await adminDb().doc(`slots/${id}`).get()).data()!.title, 'Intermediate 201-D');
  book.grid('Slots').pop();

  // A blank cell in the sheet doesn't blank the slot.
  book.slotRow(id)![1] = '';
  await syncSheet(book, adminDb());
  assert.equal((await adminDb().doc(`slots/${id}`).get()).data()!.title, 'Intermediate 201-D');
  assert.equal(book.slotRow(id)![1], 'Intermediate 201-D');
});

test('check-ins record the Slots worksheet\'s class; the app title if the sheet is down', async () => {
  const made = await call(saveSlot, boss.token, { label: 'Fri 7:00pm', title: 'Basics 101-A' });
  const id = made.body.slot.id as string;
  book.slotRow(id)![1] = 'Basics 101-C'; // changed in the sheet, job not run yet
  const r = await call(qrCheckin, student.token, { slotId: id });
  assert.equal(r.body.status, 'checked-in');
  assert.equal(r.body.title, 'Basics 101-C');
  const docs = await adminDb().collection('checkins').where('slotId', '==', id).get();
  assert.equal(docs.docs[0].data().title, 'Basics 101-C');

  const other = await call(saveSlot, boss.token, { label: 'Sat 1:00pm', title: 'Musicality' });
  book.failing = true;
  const r2 = await call(qrCheckin, student.token, { slotId: other.body.slot.id });
  book.failing = false;
  assert.equal(r2.body.status, 'checked-in');
  assert.equal(r2.body.title, 'Musicality');

  // Admin-added, first of the day: the sheet's class too.
  const third = await call(saveSlot, boss.token, { label: 'Sun 2:00pm', title: 'Spins & Turns' });
  book.slotRow(third.body.slot.id)![1] = 'Stretchy Thingy';
  const r3 = await call(addCheckin, boss.token, { slotId: third.body.slot.id, date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit' }).format(new Date()), uid: student.uid });
  assert.equal(r3.body.title, 'Stretchy Thingy');
});

test('Classes refresh adds a row per new class column, once, and leaves existing rows alone', async () => {
  // WCS: titles in A and C (checkboxes B, D), grey I-style gap in E, title F (checkbox G).
  book.row1.set('WCS', [
    { text: 'Basics 101-A', checkbox: false }, { text: 'FALSE', checkbox: true },
    { text: 'Basics 101-B', checkbox: false }, { text: 'FALSE', checkbox: true },
    { text: '', checkbox: false },
    { text: 'Intermediate Prep 200', checkbox: false }, { text: 'FALSE', checkbox: true },
    { text: '', checkbox: false }, { text: 'FALSE', checkbox: true }, // untitled: no row
  ]);
  book.row1.set('Carolina Shag', [{ text: 'Shag 101', checkbox: false }, { text: 'FALSE', checkbox: true }]);
  book.row1.set('Salsa', [{ text: 'AB', checkbox: false }, { text: '101', checkbox: false }]); // not converted yet
  book.row1.set('webapp data', [{ text: 'Class', checkbox: false }, { text: 'x', checkbox: true }]);
  book.row1.set('Random Notes', [{ text: 'Idea', checkbox: false }, { text: 'x', checkbox: true }]);
  const existing = classRow('WCS', 0);
  existing[3] = 'My typed notes';
  book.grid('Classes')[1] = existing;

  assert.deepEqual(await refreshClasses(book), { added: 3 });
  const rows = book.grid('Classes').slice(1);
  assert.deepEqual(rows.map(r => r[1]), ['=WCS!A1', '=WCS!C1', '=WCS!F1', "='Carolina Shag'!A1"]);
  assert.equal(rows[0][3], 'My typed notes');
  assert.match(rows[3][2], /'Carolina Shag'!A2:A,k,'Carolina Shag'!B2:B/);
  assert.equal(rows[2][4], `=SUBSTITUTE(ADDRESS(1,COLUMN(WCS!${colLetter(5)}1),4),"1","")`);

  assert.deepEqual(await refreshClasses(book), { added: 0 });
  assert.equal(book.grid('Classes').length, 5);
});
