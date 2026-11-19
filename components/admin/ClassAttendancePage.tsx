// Admin > Attendance (attendance slice 2): pick a studio day, see each slot's
// headcount and who came, add people by hand (accounts or saved guests) and
// remove mistaken check-ins. Writes go through /api/admin/checkin*, which
// re-check everything; guests are written directly (admin-only rules).
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Search, ShieldCheck, UserPlus, UserRound, X, QrCode, RotateCw } from 'lucide-react';
import { useAccount } from '../auth/AuthProvider';
import { useToast } from '../ui/Toast';
import { BottomSheet } from '../ui/BottomSheet';
import { DancingDots, EmptyState } from '../ui/Doodles';
import {
  createGuest, dayLabel, firstOfDay, renameGuest, shiftDate, studioToday, subscribeCheckinsOn, subscribeGuests, subscribeSlots, withSheet,
  MAX_SLOT_TEXT, type DayCheckin, type Guest, type Slot,
} from '../../services/attendanceService';
import { useSyllabus } from '../../services/useSyllabus';
import { subscribeAllLevels, useDanceIndex, type Levels } from '../../services/levelsService';
import { aboveLevel } from '../../services/levels';

interface Account { uid: string; name: string; email: string }
type Person = { kind: 'account'; uid: string; name: string; sub: string } | { kind: 'guest'; id: string; name: string };

// Studio time, so a travelling admin sees when people actually scanned in Grand Rapids.
const time = (d: Date | null) => (d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Detroit' }) : '');

/** "Today" in the studio, kept current if the page stays open past midnight. */
const useStudioToday = () => {
  const [today, setToday] = useState(studioToday);
  useEffect(() => {
    const tick = () => setToday(studioToday());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return today;
};

export const ClassAttendancePage: React.FC = () => {
  const { isAdmin, service, user } = useAccount();
  const toast = useToast();
  const today = useStudioToday();
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const syllabus = useSyllabus();
  const { danceOf } = useDanceIndex(syllabus);
  const [rows, setRows] = useState<DayCheckin[] | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Add-person sheet
  const [addingTo, setAddingTo] = useState<{ slotId: string; title: string; label: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountsError, setAccountsError] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  // Remove confirm / guest rename
  const [removing, setRemoving] = useState<DayCheckin | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Guest | null>(null);
  const [levels, setLevels] = useState<Record<string, Levels>>({});
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    setFailed(false);
    const fail = (e: unknown) => { console.error('attendance', e); setFailed(true); };
    const a = subscribeSlots(setSlots, fail);
    const b = subscribeGuests(setGuests, fail);
    // Slice 5: levels only flag "above level"; failing to load them hides the flag.
    const c = subscribeAllLevels(setLevels);
    return () => { a(); b(); c(); };
  }, [isAdmin, attempt]);

  useEffect(() => {
    if (!isAdmin) return;
    setRows(null);
    setFailed(false);
    return subscribeCheckinsOn(date, setRows, e => { console.error('checkins', e); setFailed(true); });
  }, [isAdmin, date, attempt]);

  // The accounts list loads the first time the add sheet opens.
  useEffect(() => {
    if (!addingTo || accounts || !service) return;
    let live = true;
    setAccountsError(false);
    service.authedFetch('/api/admin/users').then(
      (b: any) => live && setAccounts(b.users.map((u: any) => ({ uid: u.uid, name: u.name, email: u.email }))),
      () => live && setAccountsError(true),
    );
    return () => { live = false; };
  }, [addingTo, accounts, service]);

  const guestName = useMemo(() => new Map(guests.map(g => [g.id, g.name])), [guests]);
  const nameOf = (r: DayCheckin) => (r.guestId && guestName.get(r.guestId)) || r.name || 'Dancer';

  // Slots shown for the day: active ones, plus archived/removed ones that have check-ins that day.
  const groups = useMemo(() => {
    if (!slots || !rows) return null;
    const bySlot = new Map<string, DayCheckin[]>();
    rows.forEach(r => bySlot.set(r.slotId, [...(bySlot.get(r.slotId) ?? []), r]));
    const known = new Set(slots.map(s => s.id));
    const list = slots
      .filter(s => !s.archived || bySlot.has(s.id))
      .map(s => withSheet(s, syllabus))
      .map(s => ({ id: s.id, label: s.label, title: s.title, active: !s.archived, people: bySlot.get(s.id) ?? [] }));
    bySlot.forEach((people, id) => {
      if (!known.has(id)) list.push({ id, label: people[0].slotLabel, title: people[0].title, active: false, people });
    });
    return list.map(g => {
      // The title recorded that day (the day's first check-in, same rule as the server) wins over the slot's current one.
      const first = firstOfDay<DayCheckin>(g.people);
      return {
        ...g,
        title: first?.title || g.title,
        label: first?.slotLabel || g.label,
        people: [...g.people].sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
      };
    });
  }, [slots, rows, guestName, syllabus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin) {
    return <div className="card mx-auto max-w-md"><EmptyState doodle="swirl" title="Admins only." body="This page is for studio admins." /></div>;
  }

  const total = rows?.length ?? 0;
  const here = (slotId: string) => (rows ?? []).filter(r => r.slotId === slotId);

  const people: Person[] = (() => {
    const q = search.trim().toLowerCase();
    const list: Person[] = [
      // A guest linked to an account (slice 5) is added as that account.
      ...guests.filter(g => !g.linkedUid).map(g => ({ kind: 'guest' as const, id: g.id, name: g.name })),
      ...(accounts ?? []).map(a => ({ kind: 'account' as const, uid: a.uid, name: a.name || a.email.split('@')[0] || 'No name', sub: a.email })),
    ];
    const hits = q
      ? list.filter(p => p.name.toLowerCase().includes(q) || (p.kind === 'account' && p.sub.toLowerCase().includes(q)))
      : list;
    return hits.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
  })();

  const isHere = (p: Person) =>
    !!addingTo && here(addingTo.slotId).some(r => (p.kind === 'account' ? r.uid === p.uid : r.guestId === p.id));

  const checkIn = async (p: Person) => {
    if (!addingTo || !service) return;
    const key = p.kind === 'account' ? p.uid : p.id;
    setAdding(key);
    try {
      const body = p.kind === 'account' ? { slotId: addingTo.slotId, date, uid: p.uid } : { slotId: addingTo.slotId, date, guestId: p.id };
      const r: any = await service.authedFetch('/api/admin/checkin', { method: 'POST', body: JSON.stringify(body) });
      toast.show(r.status === 'already' ? `${p.name} is already here.` : `${p.name} checked in.`, 'success');
    } catch (e: any) {
      console.error(e);
      toast.show(e?.message || "Couldn't check them in. Try again.", 'error');
    } finally {
      setAdding(null);
    }
  };

  const addGuest = async () => {
    const name = search.trim().slice(0, MAX_SLOT_TEXT);
    if (!name || !user) return;
    setAdding('new');
    let id: string;
    try {
      id = await createGuest(name, user.uid);
    } catch (e) {
      console.error(e);
      toast.show("Couldn't add that guest. Try again.", 'error');
      setAdding(null);
      return;
    }
    // Search by the new guest's name, so if the check-in fails they're right there to tap.
    setSearch(name);
    await checkIn({ kind: 'guest', id, name });
  };

  const remove = async () => {
    if (!removing || !service) return;
    setBusy(true);
    try {
      await service.authedFetch('/api/admin/checkin-remove', { method: 'POST', body: JSON.stringify({ id: removing.id }) });
      toast.show(`Removed ${nameOf(removing)}.`, 'success');
      setRemoving(null);
    } catch (e: any) {
      console.error(e);
      toast.show(e?.status === 404 ? 'That check-in was already removed.' : "Couldn't remove it. Try again.", 'error');
      if (e?.status === 404) setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  const saveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming || !newName.trim()) return;
    setBusy(true);
    try {
      await renameGuest(renaming.id, newName);
      toast.show('Guest renamed.', 'success');
      setRenaming(null);
    } catch (err) {
      console.error(err);
      toast.show("Couldn't rename. Try again.", 'error');
    } finally {
      setBusy(false);
    }
  };
  const startRename = (g: Guest) => { setAddingTo(null); setRenaming(g); setNewName(g.name); };

  const typed = search.trim().toLowerCase();
  const exactGuest = guests.some(g => g.name.trim().toLowerCase() === typed);
  // Someone with an account by that exact name: warn, so their attendance isn't split across a guest copy.
  const exactAccount = (accounts ?? []).some(a => a.name.trim().toLowerCase() === typed);
  const capped = !typed && people.length >= 50;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin</p>
        <h2 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">Attendance</h2>
      </div>

      {/* Day picker: today or earlier, never the future. */}
      <div className="card mb-5 flex flex-wrap items-center gap-2 p-3">
        <button type="button" onClick={() => setDate(d => shiftDate(d, -1))} aria-label="Previous day" className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/5">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Day</span>
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-lo" />
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => { const v = e.target.value; if (v) setDate(v > today ? today : v); }}
            className="input !min-h-11 !py-2 !pl-9"
          />
        </label>
        <button
          type="button"
          onClick={() => setDate(d => (d < today ? shiftDate(d, 1) : d))}
          disabled={date >= today}
          aria-label="Next day"
          className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/5 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <p className="w-full px-1 text-[15px] text-text-mid">
          {date === today ? 'Today · ' : ''}{dayLabel(date)}
          {rows && <> · <span className="font-semibold text-text-hi">{total} checked in</span></>}
        </p>
        {date !== today && (
          <button type="button" onClick={() => setDate(today)} className="btn-secondary press min-h-11">Back to today</button>
        )}
      </div>

      {failed ? (
        <div className="card">
          <EmptyState doodle="swirl" title="Couldn't load attendance." body="Check your connection and try again."
            action={<button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-secondary press min-h-11"><RotateCw className="h-4 w-4" /> Try again</button>} />
        </div>
      ) : groups === null ? (
        <div className="flex items-center gap-3 py-6 text-text-mid"><DancingDots label="Loading attendance" /> Loading attendance…</div>
      ) : groups.length === 0 ? (
        <div className="card">
          <EmptyState doodle="sparkle" title="No class slots yet." body="Make a slot in Admin › Class slots, then people checked in to it show up here." />
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map(g => (
            <li key={g.id} className={`card p-4 md:p-5 ${g.active ? '' : 'opacity-80'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-text-lo">{g.label}{g.active ? '' : ' · archived'}</p>
                  <p className="text-[20px] font-extrabold leading-tight text-text-hi">{g.title}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-[28px] font-extrabold leading-none text-brand-soft">{g.people.length}</span>
                  <span className="text-[13px] text-text-lo">here</span>
                </p>
              </div>

              {g.people.length === 0 ? (
                <p className="mt-3 text-text-lo">Nobody checked in yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {g.people.map(r => {
                    const gst = r.guestId ? guests.find(x => x.id === r.guestId) : undefined;
                    return (
                      <li key={r.id} className="flex items-center gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-text-hi">{nameOf(r)}</p>
                          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-text-lo">
                            {r.method === 'qr'
                              ? <span className="inline-flex items-center gap-1"><QrCode className="h-3 w-3" /> QR</span>
                              : <span className="inline-flex items-center gap-1"><UserPlus className="h-3 w-3" /> Added</span>}
                            {r.guestId && <span>Guest</span>}
                            {r.uid && danceOf(r.title) && aboveLevel(r.title, levels[r.uid]?.[danceOf(r.title)!]) && (
                              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-200">Above level</span>
                            )}
                            {/* Scan time only: a manual add's time is when the admin typed it, not when they came. */}
                            {r.method === 'qr' && time(r.at) && <span>{time(r.at)}</span>}
                          </p>
                        </div>
                        {gst && (
                          <button type="button" onClick={() => startRename(gst)} aria-label={`Rename ${gst.name}`} data-tip="Rename guest" data-tip-align="end"
                            className="tip press grid h-11 w-11 place-items-center rounded-full text-text-mid hover:bg-white/5">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => setRemoving(r)} aria-label={`Remove ${nameOf(r)}`} data-tip="Remove check-in" data-tip-align="end"
                          className="tip press grid h-11 w-11 place-items-center rounded-full text-rose-300 hover:bg-rose-500/10">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {g.active && (
                <button type="button" onClick={() => { setSearch(''); setAddingTo({ slotId: g.id, title: g.title, label: g.label }); }} className="btn-secondary press mt-3 min-h-11">
                  <UserPlus className="h-4 w-4" /> Add person
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add person */}
      <BottomSheet
        open={addingTo !== null}
        onClose={() => setAddingTo(null)}
        eyebrow={addingTo ? `${addingTo.label} · ${dayLabel(date)}` : ''}
        title={addingTo ? `Add to ${addingTo.title}` : ''}
      >
        <label className="relative block">
          <span className="sr-only">Search students and guests</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-lo" />
          <input value={search} onChange={e => setSearch(e.target.value)} maxLength={MAX_SLOT_TEXT} placeholder="Name or email" className="input !pl-9" autoFocus />
        </label>
        {accountsError && <p role="status" className="mt-3 text-[14px] text-amber-200">Couldn't load accounts; only guests are listed.</p>}
        {!accounts && !accountsError && <div className="mt-4 flex items-center gap-3 text-text-mid"><DancingDots label="Loading people" /> Loading people…</div>}
        <ul className="mt-3 divide-y divide-line">
          {people.map(p => {
            const key = p.kind === 'account' ? `a:${p.uid}` : `g:${p.id}`;
            const already = isHere(p);
            return (
              <li key={key} className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  disabled={already || adding !== null}
                  onClick={() => checkIn(p)}
                  className="press flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1 text-left hover:bg-white/5 disabled:hover:bg-transparent"
                >
                  <UserRound className="h-5 w-5 shrink-0 text-text-lo" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-text-hi">{p.name}</span>
                    <span className="block truncate text-[13px] text-text-lo">{p.kind === 'account' ? p.sub : 'Guest'}</span>
                  </span>
                  {already ? (
                    <span className="shrink-0 text-[13px] font-semibold text-brand-soft">Already here</span>
                  ) : adding === (p.kind === 'account' ? p.uid : p.id) ? (
                    <DancingDots label="Checking in" />
                  ) : null}
                </button>
                {p.kind === 'guest' && (
                  <button type="button" onClick={() => startRename({ id: p.id, name: p.name })} aria-label={`Rename ${p.name}`}
                    className="press grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-mid hover:bg-white/5">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {capped && <p className="py-3 text-center text-[14px] text-text-lo">Showing the first 50. Type a name or email to find anyone else.</p>}
        {accounts && people.length === 0 && !search.trim() && (
          <p className="py-4 text-center text-text-lo">No students or guests yet. Type a name to add a guest.</p>
        )}
        {accounts && people.length === 0 && search.trim() && (
          <p className="py-4 text-center text-text-lo">Nobody matches “{search.trim()}”.</p>
        )}
        {/* After the matches, so an existing student or guest is picked before a duplicate is made. */}
        {search.trim() && !exactGuest && (
          <div className="mt-3 border-t border-line pt-3">
            <p className={`mb-2 text-[14px] ${exactAccount ? 'text-amber-200' : 'text-text-lo'}`}>
              {exactAccount
                ? `Someone with an account is already called “${search.trim()}”. If that's them, pick them above instead.`
                : 'Not on the list and has no account?'}
            </p>
            <button type="button" onClick={addGuest} disabled={adding !== null} className="btn-secondary press min-h-11 w-full">
              {adding === 'new' ? <DancingDots label="Adding" /> : <><UserPlus className="h-4 w-4" /> Add “{search.trim()}” as a new guest</>}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Remove confirm */}
      <BottomSheet open={removing !== null} onClose={() => !busy && setRemoving(null)} size="sm" title={removing ? `Remove ${nameOf(removing)}?` : ''}>
        <p className="text-text-mid">
          {removing && <>This deletes their check-in for {removing.title} on {dayLabel(removing.date)}{removing.uid ? ', and it drops off their My attendance' : ''}.</>}
        </p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => setRemoving(null)} disabled={busy} className="btn-secondary press flex-1">Cancel</button>
          <button type="button" onClick={remove} disabled={busy} className="btn-primary press flex-1 !bg-rose-600 hover:!bg-rose-500">
            {busy ? <DancingDots label="Removing" dotClass="bg-white" /> : 'Remove'}
          </button>
        </div>
      </BottomSheet>

      {/* Rename guest */}
      <BottomSheet open={renaming !== null} onClose={() => !busy && setRenaming(null)} size="sm" eyebrow="Guest" title="Rename guest">
        <form onSubmit={saveRename} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Name</span>
            <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={MAX_SLOT_TEXT} className="input" autoFocus />
          </label>
          <button type="submit" disabled={busy || !newName.trim()} className="btn-primary press min-h-11">
            {busy ? <DancingDots label="Saving" dotClass="bg-white" /> : 'Save'}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
};
