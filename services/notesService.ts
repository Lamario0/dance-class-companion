// Personal notes (spec slice 2), private to each student:
// users/{uid}/notes/{noteId}
//
// Class notes are one dated entry per class per week (weeks start Monday). Their
// id is "<classKey>__<weekOf>", so reopening the same class in the same week (on
// any device, even offline) lands on the same entry instead of a duplicate.
// Free notes get random ids.
//
// Saving never waits on the network: Firestore's offline cache keeps the write
// on the device and syncs it later. saveNote reports whether the server has
// confirmed it yet, so the UI can say "Saved on this device, will sync".
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';
import { db } from '../firebase';

export const MAX_BODY = 10000;
export const MAX_TITLE = 80;

export type NoteKind = 'class' | 'free';

export interface Note {
  id: string;
  kind: NoteKind;
  /** class notes only */
  classKey: string;
  className: string;
  pattern: string;
  /** YYYY-MM-DD of the Monday of the week (class notes); '' for free notes */
  weekOf: string;
  title: string;
  body: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** written on this device, not yet confirmed by the server */
  pending: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Monday of the week containing `d` (local time), as YYYY-MM-DD. */
export const weekOf = (d = new Date()) => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return ymd(m);
};

/** "Nov 17" from "2026-11-17". */
export const weekLabel = (week: string) => {
  const [y, mo, da] = week.split('-').map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Stable key for a class from its name: "WCS Intermediate 201" -> "wcs-intermediate-201". */
export const classKey = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'class';

export const classNoteId = (name: string, week = weekOf()) => `${classKey(name)}__${week}`;

const notesCol = (uid: string) => collection(db, 'users', uid, 'notes');

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

/** Live list of the student's notes, newest first. Returns an unsubscribe function. */
export const subscribeNotes = (uid: string, onChange: (notes: Note[]) => void, onError: (e: FirestoreError) => void) =>
  onSnapshot(
    notesCol(uid),
    { includeMetadataChanges: true },
    snap => {
      const notes = snap.docs.map(d => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return {
          id: d.id,
          kind: x.kind === 'class' ? 'class' : 'free',
          classKey: x.classKey ?? '',
          className: x.className ?? '',
          pattern: x.pattern ?? '',
          weekOf: x.weekOf ?? '',
          title: x.title ?? '',
          body: x.body ?? '',
          createdAt: toDate(x.createdAt),
          updatedAt: toDate(x.updatedAt),
          pending: d.metadata.hasPendingWrites,
        } as Note;
      });
      const t = (n: Note) => (n.weekOf ? Date.parse(n.weekOf) : 0) || n.updatedAt?.getTime() || n.createdAt?.getTime() || 0;
      notes.sort((a, b) => t(b) - t(a) || (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
      onChange(notes);
    },
    onError,
  );

export interface NoteDraft {
  kind: NoteKind;
  className?: string;
  pattern?: string;
  weekOf?: string;
  title?: string;
  body: string;
}

const CONFIRM_WAIT_MS = 2500;

/**
 * Create or update a note. Resolves with `synced: false` when the write is only
 * on this device so far (offline or slow); Firestore keeps it and syncs later.
 * Rejects only if the write is refused (e.g. rules).
 */
export const saveNote = async (
  uid: string,
  draft: NoteDraft,
  existingId: string | null,
): Promise<{ id: string; synced: boolean }> => {
  const body = draft.body.slice(0, MAX_BODY);
  const title = (draft.title ?? '').trim().slice(0, MAX_TITLE);
  let id: string;
  let write: Promise<void>;

  if (existingId) {
    id = existingId;
    write = updateDoc(doc(notesCol(uid), id), { body, title, updatedAt: serverTimestamp() });
  } else {
    const isClass = draft.kind === 'class';
    const week = draft.weekOf || weekOf();
    id = isClass ? classNoteId(draft.className || '', week) : doc(notesCol(uid)).id;
    write = setDoc(doc(notesCol(uid), id), {
      kind: draft.kind,
      classKey: isClass ? classKey(draft.className || '') : '',
      className: isClass ? (draft.className || '').slice(0, 100) : '',
      pattern: isClass ? (draft.pattern || '').slice(0, 300) : '',
      weekOf: isClass ? week : '',
      title,
      body,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Offline the write promise only settles once the server confirms, so don't
  // wait for it forever: after a short wait, report "saved on this device".
  let settled = false;
  const confirmed = write.then(() => {
    settled = true;
    return true;
  });
  const timeout = new Promise<false>(r => setTimeout(() => r(false), CONFIRM_WAIT_MS));
  const synced = await Promise.race([confirmed, timeout]);
  if (!synced && !settled) {
    // Still surface a later refusal (rules) in the console; the snapshot listener drops the note.
    confirmed.catch(err => console.error('Note sync was refused', err));
  }
  return { id, synced };
};

export const deleteNote = (uid: string, id: string) => {
  const write = deleteDoc(doc(notesCol(uid), id));
  // Same offline behaviour as saving: the delete shows locally right away.
  return Promise.race([write, new Promise<void>(r => setTimeout(r, CONFIRM_WAIT_MS))]);
};
