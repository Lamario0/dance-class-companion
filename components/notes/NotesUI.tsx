// Notes UI (spec slice 2). Loaded lazily: it pulls in Firestore via notesService.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Plus, Trash2, CloudOff, Check, NotebookPen } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { DancingDots, EmptyState, NoteDoodle } from '../ui/Doodles';
import { useToast } from '../ui/Toast';
import { useAccount } from '../auth/AuthProvider';
import {
  subscribeNotes,
  saveNote,
  deleteNote,
  weekOf,
  weekLabel,
  classKey,
  classNoteId,
  MAX_BODY,
  MAX_TITLE,
  type Note,
  type NoteDraft,
} from '../../services/notesService';

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

const useNotes = () => {
  const { user } = useAccount();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!user) return;
    setNotes(null);
    setError(false);
    return subscribeNotes(
      user.uid,
      setNotes,
      err => {
        console.error('Notes failed to load', err);
        setError(true);
      },
    );
  }, [user]);
  return { notes, error, uid: user?.uid ?? null };
};

/* ------------------------------------------------------------------ */
/* Editor                                                             */
/* ------------------------------------------------------------------ */

interface EditorProps {
  uid: string;
  /** existing note, or null for a new one built from `draft` */
  note: Note | null;
  draft: NoteDraft;
  heading?: React.ReactNode;
  onDirtyChange: (dirty: boolean) => void;
  onSaved?: (id: string) => void;
  onDeleted?: () => void;
}

const NoteEditor: React.FC<EditorProps> = ({ uid, note, draft, heading, onDirtyChange, onSaved, onDeleted }) => {
  const toast = useToast();
  const [body, setBody] = useState(note?.body ?? draft.body);
  const [title, setTitle] = useState(note?.title ?? draft.title ?? '');
  const [busy, setBusy] = useState<false | 'save' | 'delete'>(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | null>(note?.id ?? null);

  // Keep the editor in step if the note changes elsewhere while untouched.
  const base = { body: note?.body ?? draft.body, title: note?.title ?? draft.title ?? '' };
  const dirty = body !== base.body || title !== base.title;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) {
      setBody(base.body);
      setTitle(base.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.body, note?.title]);

  const isFree = draft.kind === 'free';

  const save = async () => {
    if (!dirty || busy) return;
    setBusy('save');
    setError('');
    try {
      const { id, synced } = await saveNote(uid, { ...draft, body, title }, note?.id ?? savedId);
      setSavedId(id);
      toast.show(synced ? 'Saved' : 'Saved on this device, will sync', 'success');
      onSaved?.(id);
    } catch (err) {
      console.error(err);
      setError("Couldn't save this note. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const id = note?.id ?? savedId;
    if (!id) return;
    setBusy('delete');
    try {
      await deleteNote(uid, id);
      toast.show('Note deleted', 'success');
      onDirtyChange(false);
      onDeleted?.();
    } catch (err) {
      console.error(err);
      setError("Couldn't delete this note. Please try again.");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div>
      {heading}
      {isFree && (
        <div className="mb-3">
          <label htmlFor="note-title" className="sr-only">Title</label>
          <input
            id="note-title"
            value={title}
            maxLength={MAX_TITLE}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="input !min-h-11 !py-2 font-semibold"
          />
        </div>
      )}
      <label htmlFor="note-body" className="sr-only">Note</label>
      <textarea
        id="note-body"
        value={body}
        maxLength={MAX_BODY}
        onChange={e => setBody(e.target.value)}
        placeholder={isFree ? 'Write anything: drills, goals, songs to try…' : 'What clicked this week? Counts, cues, what to practice…'}
        rows={8}
        className="input min-h-[11rem] resize-y leading-relaxed"
      />
      <div className="mt-1 flex items-center justify-between text-[13px] text-text-lo">
        <span className="flex items-center gap-1.5">
          {note?.pending ? (
            <><CloudOff className="h-3.5 w-3.5" /> On this device, will sync</>
          ) : note || savedId ? (
            dirty ? 'Unsaved changes' : <><Check className="h-3.5 w-3.5" /> Saved</>
          ) : dirty ? 'Not saved yet' : ''}
        </span>
        <span className="tabular-nums">{body.length > MAX_BODY * 0.9 ? `${body.length}/${MAX_BODY}` : ''}</span>
      </div>

      {error && <p role="alert" className="mt-3 rounded-[var(--radius-sm)] bg-rose-500/10 px-3 py-2 text-[15px] text-rose-200">{error}</p>}

      {confirmDelete ? (
        <div className="mt-4 rounded-[var(--radius-md)] bg-rose-500/10 p-4">
          <p className="text-[15px] text-rose-100">Delete this note? This can't be undone.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary press flex-1">Keep it</button>
            <button type="button" onClick={remove} disabled={!!busy} className="btn-primary press flex-1 !bg-rose-600 hover:!bg-rose-500">
              {busy === 'delete' ? <DancingDots label="Deleting" dotClass="bg-white" /> : 'Delete'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          {(note || savedId) && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete note"
              data-tip="Delete note"
              className="tip press grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-md)] text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button type="button" onClick={save} disabled={!dirty || !!busy} className="btn-primary press flex-1">
            {busy === 'save' ? <DancingDots label="Saving" dotClass="bg-white" /> : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

/** "Discard your changes?" banner shown above the editor (which stays mounted, so Keep editing keeps the text). */
const DiscardPrompt: React.FC<{ onKeep: () => void; onDiscard: () => void }> = ({ onKeep, onDiscard }) => (
  <div role="alertdialog" aria-label="Discard your changes?" className="mb-5 rounded-[var(--radius-md)] bg-amber-500/10 p-4 animate-fade">
    <p className="font-bold">Discard your changes?</p>
    <p className="mt-1 text-[15px] text-text-mid">Your edits to this note haven't been saved.</p>
    <div className="mt-3 flex gap-2">
      <button type="button" onClick={onKeep} className="btn-primary press flex-1">Keep editing</button>
      <button type="button" onClick={onDiscard} className="btn-secondary press flex-1">Discard</button>
    </div>
  </div>
);

const NoteRow: React.FC<{ note: Note; onOpen: () => void; showClass?: boolean }> = ({ note, onOpen, showClass }) => {
  const label = note.kind === 'class' ? `Week of ${weekLabel(note.weekOf)}` : note.title || 'Untitled note';
  const sub = note.kind === 'class' ? (showClass ? note.className : note.pattern) : '';
  return (
    <li>
      <button type="button" onClick={onOpen} className="press flex min-h-[56px] w-full items-start gap-3 rounded-[var(--radius-sm)] px-2 py-2.5 text-left hover:bg-surface-2">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-text-hi">{label}</span>
            {note.pending && <CloudOff className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Not synced yet" />}
          </span>
          {sub && <span className="block truncate text-[13px] text-text-lo">{sub}</span>}
          <span className="block truncate text-[14px] text-text-mid">{note.body || <em className="text-text-lo">Empty</em>}</span>
        </span>
      </button>
    </li>
  );
};

/* ------------------------------------------------------------------ */
/* Class notes sheet (opened from a class card)                       */
/* ------------------------------------------------------------------ */

export const ClassNotesSheet: React.FC<{ open: boolean; onClose: () => void; className: string; pattern: string }> = ({
  open,
  onClose,
  className,
  pattern,
}) => {
  const { notes, error, uid } = useNotes();
  const [openId, setOpenId] = useState<string | null>(null); // an earlier entry being edited
  const [dirty, setDirty] = useState(false);
  const [askDiscard, setAskDiscard] = useState<null | (() => void)>(null);

  const week = useMemo(() => weekOf(), [open]);
  const key = classKey(className);
  const thisWeekId = classNoteId(className, week);
  const mine = (notes ?? []).filter(n => n.kind === 'class' && n.classKey === key);
  const thisWeek = mine.find(n => n.id === thisWeekId) ?? null;
  const earlier = mine.filter(n => n.id !== thisWeekId);
  const opened = openId ? mine.find(n => n.id === openId) ?? null : null;

  // Each opening starts fresh, so discarded edits never come back on reopen.
  const [session, setSession] = useState(0);
  useEffect(() => {
    if (!open) {
      setOpenId(null);
      setDirty(false);
      setAskDiscard(null);
      setSession(s => s + 1);
    }
  }, [open]);

  const guard = (action: () => void) => () => (dirty ? setAskDiscard(() => action) : action());
  const close = guard(onClose);

  return (
    <BottomSheet open={open} onClose={close} eyebrow="My notes" title={className}>
      {askDiscard && (
        <DiscardPrompt onKeep={() => setAskDiscard(null)} onDiscard={() => { const a = askDiscard; setAskDiscard(null); setDirty(false); a(); }} />
      )}
      {!uid ? null : error ? (
        <EmptyState compact doodle="swirl" title="Couldn't load your notes." body="Check your connection and try again." />
      ) : !notes ? (
        <div className="flex justify-center py-10"><DancingDots label="Loading your notes" /></div>
      ) : opened ? (
        <NoteEditor
          key={`${session}-${opened.id}`}
          uid={uid}
          note={opened}
          draft={{ kind: 'class', className, body: '' }}
          onDirtyChange={setDirty}
          onDeleted={() => setOpenId(null)}
          heading={
            <div className="mb-3 flex items-center gap-1">
              <button type="button" onClick={guard(() => setOpenId(null))} aria-label="Back to this week" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-text-mid hover:bg-surface-2">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="font-semibold">Week of {weekLabel(opened.weekOf)}</p>
                {opened.pattern && <p className="truncate text-[14px] text-text-lo">{opened.pattern}</p>}
              </div>
            </div>
          }
        />
      ) : (
        <>
          <NoteEditor
            key={`${session}-${thisWeek?.id ?? `new-${thisWeekId}`}`}
            uid={uid}
            note={thisWeek}
            draft={{ kind: 'class', className, pattern, weekOf: week, body: '' }}
            onDirtyChange={setDirty}
            heading={
              <div className="mb-3">
                <p className="font-semibold">This week · {weekLabel(week)}</p>
                {(thisWeek?.pattern || pattern) && <p className="text-[14px] text-text-lo">{thisWeek?.pattern || pattern}</p>}
              </div>
            }
          />
          {earlier.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="eyebrow mb-1">Earlier notes</p>
              <ul className="divide-y divide-line">
                {earlier.map(n => <NoteRow key={n.id} note={n} onOpen={guard(() => setOpenId(n.id))} />)}
              </ul>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
};

/* ------------------------------------------------------------------ */
/* Notebook (inside the account sheet)                                */
/* ------------------------------------------------------------------ */

/**
 * All of the student's notes: class notes grouped by class, then free notes.
 * `registerGuard` lets the account sheet ask "Discard your changes?" before closing.
 */
export const Notebook: React.FC<{ registerGuard: (dirty: boolean) => void }> = ({ registerGuard }) => {
  const { notes, error, uid } = useNotes();
  const [view, setView] = useState<null | { id: string | null }>(null); // null = list; id null = new free note
  const [dirty, setDirty] = useState(false);
  const [askDiscard, setAskDiscard] = useState<null | (() => void)>(null);
  useEffect(() => registerGuard(dirty), [dirty, registerGuard]);
  useEffect(() => () => registerGuard(false), [registerGuard]);

  if (!uid) return null;
  if (error) return <EmptyState compact doodle="swirl" title="Couldn't load your notes." body="Check your connection and try again." />;
  if (!notes) return <div className="flex justify-center py-6"><DancingDots label="Loading your notes" /></div>;

  const guard = (action: () => void) => () => (dirty ? setAskDiscard(() => action) : action());
  const back = guard(() => { setDirty(false); setView(null); });

  const prompt = askDiscard && (
    <DiscardPrompt onKeep={() => setAskDiscard(null)} onDiscard={() => { const a = askDiscard; setAskDiscard(null); setDirty(false); a(); }} />
  );

  if (view) {
    const note = view.id ? notes.find(n => n.id === view.id) ?? null : null;
    const isClass = note?.kind === 'class';
    return (
      <>
      {prompt}
      <NoteEditor
        key={view.id ?? 'new'}
        uid={uid}
        note={note}
        draft={isClass ? { kind: 'class', className: note!.className, body: '' } : { kind: 'free', body: '', title: '' }}
        onDirtyChange={setDirty}
        onSaved={id => !view.id && setView({ id })}
        onDeleted={() => setView(null)}
        heading={
          <div className="mb-3 flex items-center gap-1">
            <button type="button" onClick={back} aria-label="Back to my notes" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-text-mid hover:bg-surface-2">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate font-semibold">{isClass ? note!.className : view.id ? 'Note' : 'New note'}</p>
              {isClass && <p className="truncate text-[14px] text-text-lo">Week of {weekLabel(note!.weekOf)}{note!.pattern ? ` · ${note!.pattern}` : ''}</p>}
            </div>
          </div>
        }
      />
      </>
    );
  }

  const classGroups = new Map<string, Note[]>();
  notes.filter(n => n.kind === 'class').forEach(n => {
    const g = classGroups.get(n.className) ?? [];
    g.push(n);
    classGroups.set(n.className, g);
  });
  const free = notes.filter(n => n.kind === 'free');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 font-bold"><NotebookPen className="h-5 w-5 text-brand-soft" /> My notes</p>
        <button type="button" onClick={() => setView({ id: null })} className="btn-secondary press !min-h-11 !px-3 text-[15px]">
          <Plus className="h-4 w-4" /> New note
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-surface-2/60 p-4 text-[15px] text-text-mid">
          <NoteDoodle className="h-6 w-6 shrink-0 text-brand-soft" still />
          <p>No notes yet. Tap <span className="font-semibold text-text-hi">My notes</span> on a class card, or start a free note here.</p>
        </div>
      ) : (
        <div className="max-h-[45vh] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
          {[...classGroups.entries()].map(([name, list]) => (
            <section key={name} className="mt-3">
              <p className="eyebrow mb-1">{name}</p>
              <ul className="divide-y divide-line">{list.map(n => <NoteRow key={n.id} note={n} onOpen={() => setView({ id: n.id })} />)}</ul>
            </section>
          ))}
          {free.length > 0 && (
            <section className="mt-3">
              <p className="eyebrow mb-1">Free notes</p>
              <ul className="divide-y divide-line">{free.map(n => <NoteRow key={n.id} note={n} onOpen={() => setView({ id: n.id })} />)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
