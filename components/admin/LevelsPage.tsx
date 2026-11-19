// Admin > Levels (attendance slice 5): who is ready to move up, each student's
// level and maximum level per dance, linking guests to accounts, and the
// class/month targets. Changes go through /api/admin/levels.
import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Link2, Unlink, Search, ShieldCheck, RotateCw, Sparkles, Save, CircleHelp } from 'lucide-react';
import { useAccount } from '../auth/AuthProvider';
import { useToast } from '../ui/Toast';
import { BottomSheet } from '../ui/BottomSheet';
import { DancingDots, EmptyState } from '../ui/Doodles';
import { useSyllabus } from '../../services/useSyllabus';
import { subscribeGuests, type Guest } from '../../services/attendanceService';
import {
  linkGuest, saveLevelSettings, setCap, setLevel, subscribeAccountCheckins, subscribeAllLevels, subscribeLevelSettings, unlinkGuest, useDanceIndex, useToday,
  type AdminCheckin, type Levels,
} from '../../services/levelsService';
import { allProgress, classLevel, DEFAULT_SETTINGS, LEVELS, LEVEL_NAMES, SETTING_KEYS, validSettings, type Level, type LevelSettings, type Progress } from '../../services/levels';

interface Account { uid: string; name: string; email: string }
const who = (a: Account | undefined) => a?.name || a?.email.split('@')[0] || 'Former student';

const SETTING_LABELS: Record<keyof LevelSettings, string> = {
  basicsClasses: '100 → 200: classes',
  basicsMonths: '100 → 200: months',
  intermediateClasses: '200 → Advanced: classes',
  intermediateMonths: '200 → Advanced: months',
};

export const LevelsPage: React.FC = () => {
  const { isAdmin, service } = useAccount();
  const toast = useToast();
  const syllabus = useSyllabus();
  const { danceOf, abDances, dances, loaded } = useDanceIndex(syllabus);
  const today = useToday();

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [levels, setLevels] = useState<Record<string, Levels> | null>(null);
  const [checkins, setCheckins] = useState<AdminCheckin[] | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [settings, setSettings] = useState<LevelSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Account | null>(null);
  const [linking, setLinking] = useState<Guest | null>(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !service) return;
    let live = true;
    setFailed(false);
    const fail = () => live && setFailed(true);
    service.authedFetch('/api/admin/users').then(b => live && setAccounts(b.users), fail);
    const stops = [subscribeAllLevels(setLevels, fail), subscribeAccountCheckins(setCheckins, fail), subscribeGuests(setGuests, fail), subscribeLevelSettings(setSettings)];
    return () => { live = false; stops.forEach(s => s()); };
  }, [isAdmin, service, attempt]);

  const byUid = useMemo(() => new Map((accounts ?? []).map(a => [a.uid, a])), [accounts]);

  // Everyone's progress, from their check-ins and stored levels.
  const { m: progressOf, missing } = useMemo(() => {
    const m = new Map<string, Progress[]>();
    const missing = new Set<string>();
    if (!levels || !checkins || !loaded) return { m, missing };
    const rows = new Map<string, AdminCheckin[]>();
    checkins.forEach(c => rows.set(c.uid, [...(rows.get(c.uid) ?? []), c]));
    for (const uid of new Set([...rows.keys(), ...Object.keys(levels)])) {
      const r = allProgress(rows.get(uid) ?? [], danceOf, abDances, levels[uid] ?? {}, settings, today);
      m.set(uid, r.progress);
      r.unplaced.forEach(t => missing.add(t));
    }
    return { m, missing };
  }, [levels, checkins, loaded, danceOf, abDances, settings, today]);

  const ready = useMemo(
    () => [...progressOf.entries()]
      .filter(([uid]) => byUid.has(uid))
      .flatMap(([uid, ps]) => ps.filter(p => p.ready).map(p => ({ uid, p })))
      .sort((a, b) => who(byUid.get(a.uid)).localeCompare(who(byUid.get(b.uid)))),
    [progressOf, byUid],
  );

  const unplaced = useMemo(() => {
    const titles = new Set<string>();
    for (const c of syllabus?.classes.values() ?? []) if (!classLevel(c.title)) titles.add(c.title);
    // Titles a check-in has but the Classes worksheet doesn't (no dance), or with no level.
    missing.forEach(t => titles.add(t));
    return [...titles].sort();
  }, [syllabus, missing]);

  if (!isAdmin) {
    return <div className="card mx-auto max-w-md"><EmptyState doodle="swirl" title="Admins only." body="This page is for studio admins." /></div>;
  }

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.show(done, 'success');
      return true;
    } catch (err) {
      toast.show((err as Error).message || 'Something went wrong. Please try again.', 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const loading = !accounts || !levels || !checkins;
  const q = query.trim().toLowerCase();
  const found = q ? (accounts ?? []).filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)).slice(0, 20) : [];
  const lq = linkQuery.trim().toLowerCase();
  const linkHits = (accounts ?? []).filter(a => !lq || a.name.toLowerCase().includes(lq) || a.email.toLowerCase().includes(lq)).slice(0, 30);
  const editDances = editing ? [...new Set([...dances, ...(progressOf.get(editing.uid) ?? []).map(p => p.dance)])].sort() : [];
  const draftValues = draft ?? Object.fromEntries(SETTING_KEYS.map(k => [k, String(settings[k])]));
  const parsedDraft = Object.fromEntries(SETTING_KEYS.map(k => [k, Number(draftValues[k])])) as unknown as LevelSettings;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin</p>
        <h2 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">Levels</h2>
      </div>

      {failed ? (
        <div className="card">
          <EmptyState doodle="swirl" title="Couldn't load levels." body="Check your connection and try again."
            action={<button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-secondary press min-h-11"><RotateCw className="h-4 w-4" /> Try again</button>} />
        </div>
      ) : loading ? (
        <div className="flex items-center gap-3 py-6 text-text-mid"><DancingDots label="Loading levels" /> Loading levels…</div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Ready to move up */}
          <section className="card p-4 md:p-5" aria-label="Ready to move up">
            <h3 className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-brand-soft" /> Ready to move up</h3>
            {!loaded ? (
              <p className="mt-3 text-text-lo">Waiting for the class list from the sheet…</p>
            ) : ready.length === 0 ? (
              <p className="mt-3 text-text-lo">Nobody has met a target yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {ready.map(({ uid, p }) => {
                  const key = `ready:${uid}:${p.dance}`;
                  return (
                    <li key={key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-text-hi">{who(byUid.get(uid))}</p>
                        <p className="text-[14px] text-text-lo">{p.dance} · {LEVEL_NAMES[p.level]} · {p.counted} classes · {p.months} months</p>
                      </div>
                      <button type="button" disabled={busy !== null} onClick={() => run(key, () => setLevel(uid, p.dance, p.next!), `${who(byUid.get(uid))} is now ${LEVEL_NAMES[p.next!]} in ${p.dance}`)}
                        className="btn-primary press min-h-11 shrink-0">
                        {busy === key ? <DancingDots label="Saving" dotClass="bg-current" /> : p.inviteOnly ? 'Invite to Advanced' : `Move up to ${p.next}`}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* A student's levels */}
          <section className="card p-4 md:p-5" aria-label="Student levels">
            <h3 className="flex items-center gap-2 font-bold"><GraduationCap className="h-4 w-4 text-brand-soft" /> Student levels</h3>
            <p className="mt-1 text-[14px] text-text-lo">Promote anyone to any level, move them down, or set the highest level they can reach.</p>
            <label className="relative mt-3 block">
              <span className="sr-only">Find a student</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-lo" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a student by name or email" className="input !pl-9" />
            </label>
            {q && (found.length === 0 ? (
              <p className="py-4 text-center text-text-lo">No accounts match “{query}”.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {found.map(a => (
                  <li key={a.uid}>
                    <button type="button" onClick={() => setEditing(a)} className="press flex min-h-11 w-full flex-col items-start py-2 text-left">
                      <span className="font-semibold text-text-hi">{who(a)}</span>
                      <span className="text-[14px] text-text-lo">
                        {(Object.entries(levels![a.uid] ?? {}) as [string, { level: Level; cap?: Level | null }][]).map(([d, l]) => `${d}: ${l.level}${l.cap ? ` (max ${l.cap})` : ''}`).join(' · ') || 'All 100 level'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </section>

          {/* Guests */}
          <section className="card p-4 md:p-5" aria-label="Guests">
            <h3 className="flex items-center gap-2 font-bold"><Link2 className="h-4 w-4 text-brand-soft" /> Guests</h3>
            <p className="mt-1 text-[14px] text-text-lo">Link a guest to the student's account so their classes count.</p>
            {guests.length === 0 ? (
              <p className="mt-3 text-text-lo">No guests yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {guests.map(g => {
                  const key = `guest:${g.id}`;
                  return (
                    <li key={g.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-text-hi">{g.name}</p>
                        {g.linkedUid && <p className="truncate text-[14px] text-text-lo">Linked to {who(byUid.get(g.linkedUid))}</p>}
                      </div>
                      {g.linkedUid ? (
                        <button type="button" disabled={busy !== null} onClick={() => run(key, () => unlinkGuest(g.id), `${g.name} unlinked`)} className="btn-secondary press min-h-11 shrink-0">
                          {busy === key ? <DancingDots label="Unlinking" dotClass="bg-current" /> : <><Unlink className="h-4 w-4" /> Unlink</>}
                        </button>
                      ) : (
                        <button type="button" disabled={busy !== null} onClick={() => { setLinkQuery(''); setLinking(g); }} className="btn-secondary press min-h-11 shrink-0">
                          <Link2 className="h-4 w-4" /> Link
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Targets */}
          <section className="card p-4 md:p-5" aria-label="Targets">
            <h3 className="font-bold">Targets</h3>
            <p className="mt-1 text-[14px] text-text-lo">The same for every dance. Advanced Concepts stays invite only.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SETTING_KEYS.map(k => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-[14px] text-text-mid">{SETTING_LABELS[k]}</span>
                  <input type="number" inputMode="numeric" min={0} max={120} value={draftValues[k]} onChange={e => setDraft({ ...draftValues, [k]: e.target.value })} className="input" />
                </label>
              ))}
            </div>
            <button type="button" disabled={busy !== null || !draft || !validSettings(parsedDraft)}
              onClick={async () => { if (await run('settings', () => saveLevelSettings(parsedDraft), 'Targets saved')) setDraft(null); }}
              className="btn-primary press mt-4 min-h-11">
              {busy === 'settings' ? <DancingDots label="Saving" dotClass="bg-current" /> : <><Save className="h-4 w-4" /> Save targets</>}
            </button>
            {draft && !validSettings(parsedDraft) && <p className="mt-2 text-[14px] text-amber-200">Use whole numbers from 0 to 120.</p>}
          </section>

          {unplaced.length > 0 && (
            <section className="card p-4 md:p-5" aria-label="Classes without a level">
              <h3 className="flex items-center gap-2 font-bold"><CircleHelp className="h-4 w-4 text-amber-200" /> Classes without a level</h3>
              <p className="mt-1 text-[14px] text-text-lo">
                These count toward nothing: the title doesn't say AB, Basics/1xx, Intermediate/2xx or ADV, or it isn't in the Classes worksheet (an old or misspelled title). Fix the title in the sheet if it should count.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {unplaced.map(t => <li key={t} className="rounded-full bg-surface-2 px-3 py-1 text-[14px] text-text-mid">{t}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* One student's levels */}
      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} eyebrow="Levels" title={editing ? who(editing) : ''}>
        {editing && (
          <ul className="flex flex-col gap-4">
            {editDances.map(d => {
              const cur = levels?.[editing.uid]?.[d];
              const level = cur?.level ?? '100';
              const cap = cur?.cap ?? null;
              const p = progressOf.get(editing.uid)?.find(x => x.dance === d);
              return (
                <li key={d} className="rounded-[var(--radius-sm)] bg-surface-2 p-3">
                  <p className="font-bold">{d}</p>
                  {p && p.next && !p.needsAB && <p className="text-[14px] text-text-lo">{p.counted} of {p.classesNeeded} classes · {p.months} of {p.monthsNeeded} months toward {p.next}</p>}
                  {p?.needsAB && <p className="text-[14px] text-text-lo">Hasn't taken AB yet</p>}
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[14px] text-text-mid">Level</span>
                      <select value={level} disabled={busy !== null} className="input"
                        onChange={e => run(`lvl:${d}`, () => setLevel(editing.uid, d, e.target.value as Level), `${d}: ${LEVEL_NAMES[e.target.value as Level]}`)}>
                        {LEVELS.map(l => <option key={l} value={l} disabled={!!cap && LEVELS.indexOf(l) > LEVELS.indexOf(cap)}>{LEVEL_NAMES[l]}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[14px] text-text-mid">Highest level</span>
                      <select value={cap ?? ''} disabled={busy !== null} className="input"
                        onChange={e => run(`cap:${d}`, () => setCap(editing.uid, d, (e.target.value || null) as Level | null), e.target.value ? `${d}: highest level ${LEVEL_NAMES[e.target.value as Level]}` : `${d}: no limit`)}>
                        <option value="">No limit</option>
                        {LEVELS.map(l => <option key={l} value={l} disabled={LEVELS.indexOf(l) < LEVELS.indexOf(level)}>{LEVEL_NAMES[l]}</option>)}
                      </select>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>

      {/* Link a guest */}
      <BottomSheet open={linking !== null} onClose={() => setLinking(null)} eyebrow="Link guest" title={linking ? `Whose account is ${linking.name}?` : ''}>
        <label className="relative block">
          <span className="sr-only">Search accounts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-lo" />
          <input value={linkQuery} onChange={e => setLinkQuery(e.target.value)} placeholder="Name or email" className="input !pl-9" autoFocus />
        </label>
        <ul className="mt-3 divide-y divide-line">
          {linkHits.map(a => (
            <li key={a.uid}>
              <button type="button" disabled={busy !== null} className="press flex min-h-11 w-full flex-col items-start py-2 text-left"
                onClick={async () => {
                  const g = linking!;
                  if (await run(`link:${g.id}`, () => linkGuest(g.id, a.uid), `${g.name}'s classes now count for ${who(a)}`)) setLinking(null);
                }}>
                <span className="font-semibold text-text-hi">{who(a)}</span>
                <span className="text-[14px] text-text-lo">{a.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
};
