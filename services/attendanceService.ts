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

export const createSlot = (label: string, title: string) =>
  addDoc(collection(db, 'slots'), { label: label.trim(), title: title.trim(), archived: false, createdAt: serverTimestamp() });

export const updateSlot = (id: string, patch: Partial<Pick<Slot, 'label' | 'title' | 'archived'>>) => {
  const clean: Record<string, unknown> = { ...patch };
  if (typeof patch.label === 'string') clean.label = patch.label.trim();
  if (typeof patch.title === 'string') clean.title = patch.title.trim();
  return updateDoc(doc(db, 'slots', id), clean);
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
