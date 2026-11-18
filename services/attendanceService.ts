// Attendance (docs/spec.md, slice 1): class slots and check-ins.
// slots/{slotId}: label, title, archived, createdAt. Anyone reads; admins write.
// checkins/{slotId__YYYY-MM-DD__uid}: written only by /api/checkin.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from './authService';
import { patchSyllabusSlot, type Syllabus } from './dataService';

export const MAX_SLOT_TEXT = 60;

export interface Slot {
  id: string;
  label: string;
  title: string;
  archived: boolean;
}

export interface Checkin {
  id: string;
  slotId: string;
  slotLabel: string;
  title: string;
  /** studio day, YYYY-MM-DD (America/Detroit) */
  date: string;
  at: Date | null;
}

/** The permanent link a slot's QR encodes. Always the website, so any phone camera opens it. */
export const checkinLink = (slotId: string) => `https://danceclasscompanion.com/checkin/${slotId}`;

/** Slot id from a /checkin/<id> path, or null. */
export const slotIdFromPath = (path: string) => {
  const m = /^\/checkin\/([A-Za-z0-9_-]{1,64})\/?$/.exec(path);
  return m ? m[1] : null;
};

export const getSlot = async (slotId: string): Promise<Slot | null> => {
  const snap = await getDoc(doc(db, 'slots', slotId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { id: snap.id, label: d.label, title: d.title, archived: d.archived === true };
};

export const subscribeSlots = (onChange: (slots: Slot[]) => void, onError: (e: FirestoreError) => void) =>
  onSnapshot(
    query(collection(db, 'slots'), orderBy('createdAt', 'asc')),
    snap => onChange(snap.docs.map(s => ({ id: s.id, label: s.data().label, title: s.data().title, archived: s.data().archived === true }))),
    onError,
  );

// Slice 3A: slots are saved through the server, which also writes the Slots worksheet.
// Resolves to whether the sheet was updated now (false = the 15-minute job will).
const saveSlot = async (body: Record<string, unknown>) => {
  const r: { slot: Slot; synced: boolean } = await authedFetch('/api/admin/slot', { method: 'POST', body: JSON.stringify(body) });
  patchSyllabusSlot(r.slot);
  return r;
};

export const createSlot = (label: string, title: string) => saveSlot({ label: label.trim(), title: title.trim() });

export const updateSlot = (id: string, patch: Partial<Pick<Slot, 'label' | 'title' | 'archived'>>) => {
  const clean: Record<string, unknown> = { id, ...patch };
  if (typeof patch.label === 'string') clean.label = patch.label.trim();
  if (typeof patch.title === 'string') clean.title = patch.title.trim();
  return saveSlot(clean);
};

/** The slot as the Slots worksheet has it (the sheet wins when it has a row). */
export const withSheet = <T extends { id: string; label: string; title: string }>(slot: T, s: Syllabus | null): T => {
  const row = s?.slots.find(x => x.id === slot.id);
  return row ? { ...slot, label: row.label || slot.label, title: row.title || slot.title } : slot;
};

export const subscribeMyCheckins = (uid: string, onChange: (rows: Checkin[]) => void, onError: (e: FirestoreError) => void) =>
  onSnapshot(
    query(collection(db, 'checkins'), where('uid', '==', uid)),
    snap => {
      const rows = snap.docs.map(s => {
        const d = s.data();
        return {
          id: s.id,
          slotId: d.slotId,
          slotLabel: d.slotLabel ?? '',
          title: d.title ?? '',
          date: d.date,
          at: (d.at as Timestamp | null)?.toDate?.() ?? null,
        };
      });
      // newest first (sorted here: avoids needing a composite index)
      rows.sort((a, b) => (b.date + (b.at?.toISOString() ?? '')).localeCompare(a.date + (a.at?.toISOString() ?? '')));
      onChange(rows);
    },
    onError,
  );

/** "Tue, Nov 17, 2026" for a YYYY-MM-DD studio day (no time-zone shift). */
export const dayLabel = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
};

// --- Slice 2: admin attendance tools ---------------------------------------

/** Today's studio day (America/Detroit), YYYY-MM-DD. Same rule as the server. */
export const studioToday = (at: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/** YYYY-MM-DD `n` days from `date` (calendar arithmetic, no time zones). */
export const shiftDate = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export interface DayCheckin extends Checkin {
  uid: string | null;
  guestId: string | null;
  name: string;
  method: 'qr' | 'manual';
}

/** Admins: every check-in on one studio day. */
export const subscribeCheckinsOn = (date: string, onChange: (rows: DayCheckin[]) => void, onError: (e: FirestoreError) => void) =>
  onSnapshot(
    query(collection(db, 'checkins'), where('date', '==', date)),
    snap =>
      onChange(
        snap.docs.map(s => {
          const d = s.data();
          return {
            id: s.id,
            slotId: d.slotId,
            slotLabel: d.slotLabel ?? '',
            title: d.title ?? '',
            date: d.date,
            at: (d.at as Timestamp | null)?.toDate?.() ?? null,
            uid: typeof d.uid === 'string' ? d.uid : null,
            guestId: typeof d.guestId === 'string' ? d.guestId : null,
            name: d.name ?? '',
            method: d.method === 'manual' ? 'manual' : 'qr',
          };
        }),
      ),
    onError,
  );

export interface Guest {
  id: string;
  name: string;
}

export const subscribeGuests = (onChange: (rows: Guest[]) => void, onError: (e: FirestoreError) => void) =>
  onSnapshot(
    collection(db, 'guests'),
    snap => onChange(snap.docs.map(s => ({ id: s.id, name: s.data().name ?? '' })).sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  );

export const createGuest = async (name: string, adminUid: string) =>
  (await addDoc(collection(db, 'guests'), { name: name.trim(), createdAt: serverTimestamp(), createdBy: adminUid })).id;

export const renameGuest = (id: string, name: string) => updateDoc(doc(db, 'guests', id), { name: name.trim() });

/** The day's first check-in (earliest time; pending server times last; then id). Its title is "the title recorded that day". Same rule as /api/admin/checkin. */
export const firstOfDay = <T extends { at: Date | null; id: string }>(rows: T[]): T | undefined =>
  [...rows].sort((a, b) => (a.at?.getTime() ?? Infinity) - (b.at?.getTime() ?? Infinity) || a.id.localeCompare(b.id))[0];
