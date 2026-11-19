// Levels in the app (attendance slice 5): reads from Firestore, admin changes
// through /api/admin/levels. The rules themselves are in ./levels.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from './authService';
import { classLevel, withDefaults, type DanceLevel, type Level, type LevelSettings } from './levels';
import type { Syllabus } from './dataService';

export type Levels = Record<string, DanceLevel>;

const fail = (what: string, onError?: (e: Error) => void) => (e: Error) => {
  console.error(what, e);
  onError?.(e);
};

/** One student's levels by dance ({} until an admin sets any). */
export const subscribeLevels = (uid: string, onChange: (l: Levels) => void, onError?: (e: Error) => void) =>
  onSnapshot(doc(db, 'levels', uid), s => onChange((s.data()?.dances ?? {}) as Levels), fail('levels', onError));

/** Admins: every student's levels, by uid. */
export const subscribeAllLevels = (onChange: (l: Record<string, Levels>) => void, onError?: (e: Error) => void) =>
  onSnapshot(collection(db, 'levels'), s => {
    const out: Record<string, Levels> = {};
    s.docs.forEach(d => (out[d.id] = (d.data().dances ?? {}) as Levels));
    onChange(out);
  }, fail('all levels', onError));

/** The class/month targets (defaults until an admin saves them). */
export const subscribeLevelSettings = (onChange: (s: LevelSettings) => void, onError?: (e: Error) => void) =>
  onSnapshot(doc(db, 'settings', 'levels'), s => onChange(withDefaults(s.data() as Partial<LevelSettings> | undefined)), fail('level settings', onError));

export interface AdminCheckin { uid: string; title: string; date: string }

/** Admins: every account check-in (title and date), for the "Ready to move up" list. */
export const subscribeAccountCheckins = (onChange: (rows: AdminCheckin[]) => void, onError?: (e: Error) => void) =>
  onSnapshot(collection(db, 'checkins'), s => {
    const rows: AdminCheckin[] = [];
    s.docs.forEach(d => {
      const c = d.data();
      if (typeof c.uid === 'string' && typeof c.title === 'string' && typeof c.date === 'string') rows.push({ uid: c.uid, title: c.title, date: c.date });
    });
    onChange(rows);
  }, fail('all check-ins', onError));

const post = (body: unknown) => authedFetch('/api/admin/levels', { method: 'POST', body: JSON.stringify(body) });
export const setLevel = (uid: string, dance: string, level: Level) => post({ action: 'set', uid, dance, level });
export const setCap = (uid: string, dance: string, cap: Level | null) => post({ action: 'cap', uid, dance, cap });
export const saveLevelSettings = (settings: LevelSettings) => post({ action: 'settings', settings });
export const linkGuest = (guestId: string, uid: string) => post({ action: 'link', guestId, uid });
export const unlinkGuest = (guestId: string) => post({ action: 'unlink', guestId });

/** Which dance each class title belongs to, and which dances have an AB class. */
export const useDanceIndex = (syllabus: Syllabus | null) =>
  useMemo(() => {
    const byTitle = new Map<string, string>();
    const abDances = new Set<string>();
    const dances = new Set<string>();
    for (const c of syllabus?.classes.values() ?? []) {
      if (!c.dance) continue;
      byTitle.set(c.title, c.dance);
      dances.add(c.dance);
      if (classLevel(c.title) === 'AB') abDances.add(c.dance);
    }
    return { danceOf: (t: string) => byTitle.get(t), abDances, dances: [...dances].sort(), loaded: !!syllabus };
  }, [syllabus]);

/** Today's studio date (YYYY-MM-DD), fixed while the page is open. */
export const useToday = () => {
  const [today] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Detroit' }));
  return today;
};

/** Subscribe helper for components: returns [value, failed]. */
export const useSubscription = <T,>(start: ((on: (v: T) => void, err: (e: Error) => void) => () => void) | null, deps: unknown[]) => {
  const [value, setValue] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!start) return;
    setValue(null);
    setFailed(false);
    return start(setValue, () => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [value, failed] as const;
};
