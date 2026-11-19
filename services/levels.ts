// Levels and progress (attendance slice 5). Pure functions shared by the app
// and the Netlify functions: which level a class title belongs to, and how far
// a student is toward the next level in each dance. No Firebase imports here.

export type Level = '100' | '200' | 'ADV';
export type ClassLevel = 'AB' | Level;

export const LEVELS: Level[] = ['100', '200', 'ADV'];
export const LEVEL_NAMES: Record<Level, string> = { '100': '100 level', '200': '200 level', ADV: 'Advanced Concepts' };
export const isLevel = (v: unknown): v is Level => v === '100' || v === '200' || v === 'ADV';
export const rank = (l: ClassLevel) => (l === 'AB' ? 0 : l === '100' ? 1 : l === '200' ? 2 : 3);

/** Admin-editable targets (the same for every dance). */
export interface LevelSettings {
  /** 100 -> 200: classes at 100 level */
  basicsClasses: number;
  /** 100 -> 200: months since the first counted 100-level class */
  basicsMonths: number;
  /** 200 -> ADV: classes at 200 level */
  intermediateClasses: number;
  /** 200 -> ADV: months since the first 200-level class */
  intermediateMonths: number;
}
export const DEFAULT_SETTINGS: LevelSettings = { basicsClasses: 12, basicsMonths: 4, intermediateClasses: 24, intermediateMonths: 6 };
export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof LevelSettings)[];
export const validSettings = (s: any): s is LevelSettings =>
  !!s && SETTING_KEYS.every(k => Number.isInteger(s[k]) && s[k] >= 0 && s[k] <= 120);
export const withDefaults = (s: Partial<LevelSettings> | undefined): LevelSettings => {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of SETTING_KEYS) if (Number.isInteger(s?.[k]) && (s![k] as number) >= 0) out[k] = s![k] as number;
  return out;
};

/**
 * The level a class title belongs to, or null if the app can't place it.
 * "AB" -> AB; "ADV"/"Advanced" -> ADV; "Basics" or a 1xx number -> 100;
 * "Intermediate" or a 2xx number -> 200.
 */
export const classLevel = (title: string): ClassLevel | null => {
  const t = title.trim();
  if (/\bAB\b/.test(t)) return 'AB';
  if (/\bADV\b|\badvanced\b/i.test(t)) return 'ADV';
  if (/\bbasics?\b/i.test(t) || /(^|\D)1\d\d(\D|$)/.test(t)) return '100';
  if (/\bintermediate\b/i.test(t) || /(^|\D)2\d\d(\D|$)/.test(t)) return '200';
  return null;
};

/** One dance's stored level for a student. */
export interface DanceLevel {
  level: Level;
  /** the highest level they may reach in this dance (none = no cap) */
  cap?: Level | null;
}

export interface Attended {
  title: string;
  /** studio date, YYYY-MM-DD */
  date: string;
}

export interface Progress {
  dance: string;
  level: Level;
  cap: Level | null;
  /** next level, or null at the top or at the cap */
  next: Level | null;
  /** the dance has an AB class and the student hasn't attended it yet */
  needsAB: boolean;
  counted: number;
  classesNeeded: number;
  /** whole months since the first counted class (0 if none) */
  months: number;
  monthsNeeded: number;
  ready: boolean;
  /** next is ADV: meeting the minimum makes them eligible for an invite */
  inviteOnly: boolean;
}

/** Whole calendar months from `from` to `to` (both YYYY-MM-DD). */
export const monthsBetween = (from: string, to: string) => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let m = (ty - fy) * 12 + (tm - fm);
  if (td < fd) m -= 1;
  return Math.max(0, m);
};

/** Each class counts once per day. */
const distinct = (rows: Attended[]) => {
  const seen = new Set<string>();
  return rows.filter(r => {
    const k = `${r.date}|${r.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * Progress in one dance. `rows` are this student's check-ins to classes of
 * this dance; `hasAB` says whether the dance has an AB class.
 */
export const danceProgress = (
  dance: string,
  rows: Attended[],
  stored: DanceLevel | undefined,
  hasAB: boolean,
  settings: LevelSettings,
  today: string,
): Progress => {
  const level = stored?.level ?? '100';
  const cap = stored?.cap ?? null;
  const all = distinct(rows).sort((a, b) => a.date.localeCompare(b.date));
  const firstAB = all.find(r => classLevel(r.title) === 'AB')?.date ?? null;
  const needsAB = hasAB && !firstAB;
  let next: Level | null = level === '100' ? '200' : level === '200' ? 'ADV' : null;
  if (next && cap && rank(next) > rank(cap)) next = null;

  const counting = level === '100' ? '100' : '200';
  const counted = all.filter(r => classLevel(r.title) === counting && !(counting === '100' && hasAB && (!firstAB || r.date < firstAB)));
  const months = counted.length ? monthsBetween(counted[0].date, today) : 0;
  const classesNeeded = level === '100' ? settings.basicsClasses : settings.intermediateClasses;
  const monthsNeeded = level === '100' ? settings.basicsMonths : settings.intermediateMonths;
  // Months are counted from the first counted class, so a month target needs at least one.
  const ready = !!next && !needsAB && counted.length >= classesNeeded && (monthsNeeded === 0 || (counted.length > 0 && months >= monthsNeeded));
  return { dance, level, cap, next, needsAB: needsAB && level === '100', counted: counted.length, classesNeeded, months, monthsNeeded, ready, inviteOnly: next === 'ADV' };
};

/** Is this class above the student's level in its dance? (show + warn, slice 5) */
export const aboveLevel = (title: string, stored: DanceLevel | undefined) => {
  const l = classLevel(title);
  return !!l && rank(l) > rank(stored?.level ?? '100');
};

/**
 * Progress for every dance the student has attended. `danceOf` maps a class
 * title to its dance (from the Classes worksheet); `abDances` are the dances
 * with an AB class. Titles with no dance are returned as `unplaced`.
 */
export const allProgress = (
  rows: Attended[],
  danceOf: (title: string) => string | undefined,
  abDances: Set<string>,
  levels: Record<string, DanceLevel>,
  settings: LevelSettings,
  today: string,
) => {
  const byDance = new Map<string, Attended[]>();
  const unplaced = new Set<string>();
  for (const r of rows) {
    const d = danceOf(r.title);
    if (!d || !classLevel(r.title)) unplaced.add(r.title);
    if (!d) continue;
    byDance.set(d, [...(byDance.get(d) ?? []), r]);
  }
  for (const d of Object.keys(levels)) if (!byDance.has(d)) byDance.set(d, []);
  const progress = [...byDance.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, rs]) => danceProgress(d, rs, levels[d], abDances.has(d), settings, today));
  return { progress, unplaced: [...unplaced].sort() };
};
