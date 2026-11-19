// Check-ins -> the Attendance worksheet (attendance slice 3B, docs/spec.md).
//
// Date | Time | Slot | Class | Name | How | Guest | Check-in ID
//
// Rows are found by Check-in ID (column H), never by position alone. New rows go
// above the first row with the same or an earlier date (newest day first). A row
// whose id is already there is rewritten in place (renames, retries), so the same
// check-in never gets two rows. Rows without an id (typed by hand) are left alone.
//
// Firestore side: each check-in has `sheet: 'pending' | 'synced'`; removals the
// sheet hasn't seen are queued in `sheetDeletes/{checkinId}` (server-only).
import { FieldValue, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { STUDIO_TZ } from './studio.mts';
import { noteSheetDown, withTimeout, type SheetsApi } from './sheets.mts';

export const ATTENDANCE = 'Attendance';

export interface AttendanceRow {
  id: string;
  /** studio day, YYYY-MM-DD */
  date: string;
  /** scan time (QR only) */
  at: Date | null;
  slotLabel: string;
  title: string;
  name: string;
  method: 'qr' | 'manual';
  guest: boolean;
}

/** The row for a check-in document. */
export const rowFor = (id: string, d: FirebaseFirestore.DocumentData): AttendanceRow => ({
  id,
  date: String(d.date ?? ''),
  at: d.at?.toDate?.() ?? (d.at instanceof Date ? d.at : null),
  slotLabel: String(d.slotLabel ?? ''),
  title: String(d.title ?? ''),
  name: String(d.name ?? ''),
  method: d.method === 'manual' ? 'manual' : 'qr',
  guest: typeof d.guestId === 'string',
});

// Sheets dates are days since 1899-12-30; times are fractions of a day.
const serialOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000 + 25_569;
};
const studioTimeFraction = (at: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: STUDIO_TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at);
  const n = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return (n('hour') * 60 + n('minute')) / 1440;
};
/** A cell's date as a serial number: a real date, or text like 11-18-2026 / 2026-11-18. */
const cellSerial = (v: string | undefined): number | null => {
  const s = (v ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.floor(Number(s));
  let m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) return serialOf(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`);
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? serialOf(s) : null;
};

const text = (s: string) => ({ userEnteredValue: { stringValue: s } });
const cells = (r: AttendanceRow) => [
  { userEnteredValue: { numberValue: serialOf(r.date) }, userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'mm-dd-yyyy' } } },
  r.method === 'qr' && r.at
    ? { userEnteredValue: { numberValue: studioTimeFraction(r.at) }, userEnteredFormat: { numberFormat: { type: 'TIME', pattern: 'h:mm AM/PM' } } }
    : { userEnteredFormat: { numberFormat: { type: 'TIME', pattern: 'h:mm AM/PM' } } },
  text(r.slotLabel),
  text(r.title),
  text(r.name),
  text(r.method === 'qr' ? 'QR' : 'Added'),
  text(r.guest ? 'yes' : ''),
  text(r.id),
];

let sheetIdCache: number | null = null;
const attendanceSheetId = async (api: SheetsApi) => {
  if (sheetIdCache !== null) return sheetIdCache;
  const s = (await api.meta(false)).find(m => m.title === ATTENDANCE);
  if (!s) throw new Error('No Attendance worksheet');
  return (sheetIdCache = s.sheetId);
};
/** Tests only. */
export const resetAttendanceCache = () => {
  sheetIdCache = null;
};

// Every Attendance write reads row positions and then sends a batch. Two writers
// at once (a scan inserting at the top while an admin removes someone) could shift
// rows in between and hit the wrong row, so writers take turns: a short lease in
// Firestore (sheetSync/attendanceLock), released at the end, expiring after 15 s.
const LOCK = 'sheetSync/attendanceLock';
const LEASE_MS = 15_000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const withAttendanceLock = async <T,>(db: Firestore, waitMs: number, fn: () => Promise<T>): Promise<T> => {
  const me = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ref = db.doc(LOCK);
  const giveUp = Date.now() + waitMs;
  for (;;) {
    const got = await db.runTransaction(async tx => {
      const held = (await tx.get(ref)).data();
      if (held && held.until > Date.now()) return false;
      tx.set(ref, { owner: me, until: Date.now() + LEASE_MS });
      return true;
    });
    if (got) break;
    if (Date.now() > giveUp) throw new Error('attendance sheet busy');
    await sleep(150);
  }
  try {
    return await fn();
  } finally {
    await db
      .runTransaction(async tx => {
        if ((await tx.get(ref)).data()?.owner === me) tx.delete(ref);
      })
      .catch(() => {});
  }
};

/** The worksheet's rows (from row 2), read right before writing. */
const readRows = async (api: SheetsApi) =>
  (await api.get(`${ATTENDANCE}!A2:H`, 'unformatted')).map(r => ({ serial: cellSerial(r[0]), id: (r[7] ?? '').trim() }));

/** Write rows: rewrite in place when the id is there, else insert in date order. One batch. */
export const upsertAttendance = async (api: SheetsApi, rows: AttendanceRow[]) => {
  if (!rows.length) return;
  const sheetId = await attendanceSheetId(api);
  const model = await readRows(api);
  const requests: object[] = [];
  // Oldest first, so each later insert lands above it within the same day.
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date) || (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
  for (const r of ordered) {
    let i = model.findIndex(m => m.id === r.id);
    if (i < 0) {
      const serial = serialOf(r.date);
      i = model.findIndex(m => m.serial !== null && m.serial <= serial);
      if (i < 0) i = model.length;
      requests.push({ insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 }, inheritFromBefore: false } });
      model.splice(i, 0, { serial, id: r.id });
    }
    // Only values and number formats: colours or wrapping set by hand survive a rewrite.
    requests.push({ updateCells: { start: { sheetId, rowIndex: i + 1, columnIndex: 0 }, rows: [{ values: cells(r) }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });
  }
  await api.batch(requests);
};

/** Delete the rows of these check-ins (every row with the id). One batch. */
export const deleteAttendance = async (api: SheetsApi, ids: string[]) => {
  const want = new Set(ids);
  if (!want.size) return;
  const sheetId = await attendanceSheetId(api);
  const hits = (await readRows(api)).map((m, i) => (want.has(m.id) ? i : -1)).filter(i => i >= 0);
  // Bottom first, so earlier indexes stay right.
  await api.batch(hits.reverse().map(i => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } } })));
};

const markSynced = async (db: Firestore, snaps: DocumentSnapshot[]) => {
  for (let i = 0; i < snaps.length; i += 400) {
    const batch = db.batch();
    // Precondition: if the check-in changed meanwhile (a rename), it stays pending.
    snaps.slice(i, i + 400).forEach(s => batch.update(s.ref, { sheet: 'synced' }, { lastUpdateTime: s.updateTime! }));
    await batch.commit().catch(async () => {
      for (const s of snaps.slice(i, i + 400)) await s.ref.update({ sheet: 'synced' }, { lastUpdateTime: s.updateTime! }).catch(() => {});
    });
  }
};

/**
 * Right after a check-in is written or changed: try the sheet now (bounded wait).
 * On failure the check-in stays `pending` for the job. Never throws.
 */
export const writeNow = async (api: SheetsApi | null, db: Firestore, ids: string[], ms: number) => {
  if (!api || !ids.length || ms < 300) return false;
  try {
    // The whole attempt (lock, reads, sheet, marking synced) fits in `ms`.
    await withTimeout(
      withAttendanceLock(db, ms, async () => {
        const snaps = (await db.getAll(...ids.map(id => db.doc(`checkins/${id}`)))).filter(s => s.exists);
        await upsertAttendance(api, snaps.map(s => rowFor(s.id, s.data()!)));
        await markSynced(db, snaps);
      }),
      ms,
    );
    return true;
  } catch (err) {
    console.warn('attendance row left for the sync job', err);
    noteSheetDown();
    resetAttendanceCache();
    return false;
  }
};

/** After a check-in is removed: delete its row now, or queue it for the job. Never throws. */
export const removeNow = async (api: SheetsApi | null, db: Firestore, id: string, ms: number) => {
  try {
    if (!api) throw new Error('sheet not connected');
    await withTimeout(withAttendanceLock(db, ms, () => deleteAttendance(api, [id])), ms);
    return true;
  } catch (err) {
    console.warn('attendance row delete queued', err);
    resetAttendanceCache();
    await db.doc(`sheetDeletes/${id}`).set({ at: FieldValue.serverTimestamp() });
    return false;
  }
};

/**
 * Give every check-in of one person (`uid` or `guestId`) a new name, marking the
 * changed ones pending, then try the sheet. Returns how many changed.
 */
export const renameCheckins = async (db: Firestore, api: SheetsApi | null, field: 'uid' | 'guestId', key: string, name: string) => {
  const docs = (await db.collection('checkins').where(field, '==', key).get()).docs.filter(d => d.data().name !== name);
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(d => batch.update(d.ref, { name, sheet: 'pending', sheetAt: FieldValue.serverTimestamp() }));
    await batch.commit();
  }
  if (docs.length) await writeNow(api, db, docs.map(d => d.id), 6000);
  return docs.length;
};

/** The job's part: first-run backfill, queued deletes, pending rows. */
export const syncAttendance = (api: SheetsApi, db: Firestore) =>
  withAttendanceLock(db, 10_000, () => syncAttendanceLocked(api, db)).catch(err => {
    resetAttendanceCache();
    throw err;
  });

/** Ones a check-in or rename started writing in the last 90 s are left to it. */
const notFresh = (d: FirebaseFirestore.QueryDocumentSnapshot, cutoff: number) => (d.data().sheetAt?.toMillis?.() ?? 0) < cutoff;

const syncAttendanceLocked = async (api: SheetsApi, db: Firestore) => {
  const cutoff = Date.now() - 90_000;
  const state = db.doc('sheetSync/attendance');
  let backfilled = 0;
  if ((await state.get()).data()?.backfilled !== true) {
    const all = (await db.collection('checkins').get()).docs.filter(d => d.data().sheet !== 'synced' && notFresh(d, cutoff));
    await upsertAttendance(api, all.map(d => rowFor(d.id, d.data())));
    await markSynced(db, all);
    await state.set({ backfilled: true, at: FieldValue.serverTimestamp() }, { merge: true });
    backfilled = all.length;
  }

  // Queued deletes; a check-in made again since (same id) keeps its row instead.
  const queued = (await db.collection('sheetDeletes').get()).docs;
  const stillThere = new Set(
    queued.length ? (await db.getAll(...queued.map(q => db.doc(`checkins/${q.id}`)))).filter(s => s.exists).map(s => s.id) : [],
  );
  await deleteAttendance(api, queued.map(q => q.id).filter(id => !stillThere.has(id)));
  for (const q of queued) await q.ref.delete();

  // Pending rows (very fresh ones are left to whoever is writing them).
  const pending = (await db.collection('checkins').where('sheet', '==', 'pending').get()).docs.filter(
    d => notFresh(d, cutoff) || stillThere.has(d.id),
  );
  await upsertAttendance(api, pending.map(d => rowFor(d.id, d.data())));
  await markSynced(db, pending);
  return { backfilled, deleted: queued.length - stillThere.size, written: pending.length };
};
