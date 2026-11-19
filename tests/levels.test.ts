// Level rules (attendance slice 5, criteria 1-4 and 8). Pure; no emulators.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classLevel, danceProgress, allProgress, aboveLevel, monthsBetween, DEFAULT_SETTINGS, withDefaults, validSettings } from '../services/levels.ts';

// The WCS titles in the live Classes worksheet on 2026-11-18.
const WCS = [
  ['Basics 101-A', '100'], ['Basics 101-B', '100'], ['Basics 101-C', '100'], ['Basics 102- Review', '100'],
  ['Intermediate Prep 200', '200'], ['Intermediate 201-A', '200'], ['Intermediate 201-I', '200'],
  ['Intermediate 10', '200'], ['Intermediate 11', '200'],
  ['Stretchy Thingy', null], ['Spins & Turns', null], ['Musicality', null],
  ['ADV Concepts 1', 'ADV'], ['ADV Concepts 6', 'ADV'],
  ['AB', 'AB'], ['Shag AB', 'AB'], ['101', '100'], ['Shag 102', '100'], ['205', '200'], ['Advanced footwork', 'ADV'],
] as const;

test('criterion 1: class titles map to levels', () => {
  for (const [title, level] of WCS) assert.equal(classLevel(title), level, title);
});

const day = (base: string, n: number) => {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekly = (title: string, start: string, count: number, every = 7) =>
  Array.from({ length: count }, (_, i) => ({ title, date: day(start, i * every) }));

test('months are whole calendar months', () => {
  assert.equal(monthsBetween('2026-07-18', '2026-11-18'), 4);
  assert.equal(monthsBetween('2026-07-19', '2026-11-18'), 3);
  assert.equal(monthsBetween('2026-11-18', '2026-11-18'), 0);
});

test('criterion 3: 12 classes over 4+ months is ready for 200; 11, or under 4 months, is not', () => {
  const s = DEFAULT_SETTINGS;
  const twelve = weekly('Basics 101-A', '2026-07-01', 12, 10); // Jul 1 .. Oct 20
  const p = danceProgress('WCS', twelve, undefined, false, s, '2026-11-18');
  assert.deepEqual([p.counted, p.months, p.ready, p.next], [12, 4, true, '200']);
  assert.equal(danceProgress('WCS', twelve.slice(0, 11), undefined, false, s, '2026-11-18').ready, false);
  const fast = weekly('Basics 101-A', '2026-09-01', 12, 3);
  const q = danceProgress('WCS', fast, undefined, false, s, '2026-11-18');
  assert.deepEqual([q.counted, q.months, q.ready], [12, 2, false]);
});

test('criterion 2: only current-level classes count, once per day, and only after AB', () => {
  const s = DEFAULT_SETTINGS;
  const rows = [
    { title: 'Basics 101-A', date: '2026-08-01' },
    { title: 'Basics 101-A', date: '2026-08-01' }, // same class, same day
    { title: 'Basics 101-B', date: '2026-08-01' }, // another class that day counts
    { title: 'Intermediate 201-A', date: '2026-08-02' }, // above level: doesn't count toward 200
    { title: 'Musicality', date: '2026-08-03' }, // unplaced
  ];
  assert.equal(danceProgress('WCS', rows, undefined, false, s, '2026-11-18').counted, 2);
  // A dance with an AB class: nothing counts until AB, and only from then on.
  const shag = [{ title: 'Shag 101', date: '2026-08-01' }, { title: 'Shag AB', date: '2026-08-05' }, { title: 'Shag 102', date: '2026-08-08' }];
  const before = danceProgress('Shag', shag.slice(0, 1), undefined, true, s, '2026-11-18');
  assert.deepEqual([before.needsAB, before.counted], [true, 0]);
  const after = danceProgress('Shag', shag, undefined, true, s, '2026-11-18');
  assert.deepEqual([after.needsAB, after.counted], [false, 1]);
  // At 200 level, 200-level classes count.
  assert.equal(danceProgress('WCS', rows, { level: '200' }, false, s, '2026-11-18').counted, 1);
});

test('criterion 4: ADV needs both the months and N 200-level classes; N comes from the settings', () => {
  const rows = weekly('Intermediate 201-A', '2026-04-01', 24, 7); // Apr 1 .. Sep 9
  const at200 = { level: '200' as const };
  const p = danceProgress('WCS', rows, at200, false, DEFAULT_SETTINGS, '2026-11-18');
  assert.deepEqual([p.counted, p.months, p.ready, p.inviteOnly, p.next], [24, 7, true, true, 'ADV']);
  assert.equal(danceProgress('WCS', rows, at200, false, { ...DEFAULT_SETTINGS, intermediateClasses: 30 }, '2026-11-18').ready, false);
  assert.equal(danceProgress('WCS', rows, at200, false, DEFAULT_SETTINGS, '2026-09-30').ready, false); // under 6 months
});

test('5a: a cap stops "ready" at the cap', () => {
  const twelve = weekly('Basics 101-A', '2026-07-01', 12, 10);
  const p = danceProgress('WCS', twelve, { level: '100', cap: '100' }, false, DEFAULT_SETTINGS, '2026-11-18');
  assert.deepEqual([p.next, p.ready], [null, false]);
  const rows = weekly('Intermediate 201-A', '2026-04-01', 24, 7);
  const q = danceProgress('WCS', rows, { level: '200', cap: '200' }, false, DEFAULT_SETTINGS, '2026-11-18');
  assert.deepEqual([q.next, q.ready], [null, false]);
  assert.equal(danceProgress('WCS', [], { level: 'ADV' }, false, DEFAULT_SETTINGS, '2026-11-18').next, null);
});

test('criterion 8: classes above the student\'s level are flagged', () => {
  assert.equal(aboveLevel('Intermediate 201-A', undefined), true);
  assert.equal(aboveLevel('Basics 101-A', undefined), false);
  assert.equal(aboveLevel('Shag AB', undefined), false);
  assert.equal(aboveLevel('ADV Concepts 1', { level: '200' }), true);
  assert.equal(aboveLevel('Intermediate 201-A', { level: '200' }), false);
  assert.equal(aboveLevel('Musicality', undefined), false);
});

test('allProgress groups by dance and lists titles it cannot place', () => {
  const danceOf = (t: string) => ({ 'Basics 101-A': 'WCS', Musicality: 'WCS', 'Shag 101': 'Shag' } as Record<string, string>)[t];
  const r = allProgress(
    [{ title: 'Basics 101-A', date: '2026-11-01' }, { title: 'Musicality', date: '2026-11-02' }, { title: 'Shag 101', date: '2026-11-03' }, { title: 'Old class', date: '2026-01-01' }],
    danceOf, new Set(['Shag']), { Hustle: { level: '200' } }, DEFAULT_SETTINGS, '2026-11-18',
  );
  assert.deepEqual(r.progress.map(p => [p.dance, p.level, p.counted, p.needsAB]), [['Hustle', '200', 0, false], ['Shag', '100', 0, true], ['WCS', '100', 1, false]]);
  assert.deepEqual(r.unplaced, ['Musicality', 'Old class']);
});

test('settings: validation and defaults', () => {
  assert.equal(validSettings(DEFAULT_SETTINGS), true);
  assert.equal(validSettings({ ...DEFAULT_SETTINGS, basicsClasses: 1.5 }), false);
  assert.equal(validSettings({ ...DEFAULT_SETTINGS, basicsMonths: -1 }), false);
  assert.equal(validSettings({ basicsClasses: 12 }), false);
  assert.deepEqual(withDefaults({ basicsClasses: 10 }), { ...DEFAULT_SETTINGS, basicsClasses: 10 });
});

test('targets of 0 mean nothing is needed', () => {
  const zero = { ...DEFAULT_SETTINGS, basicsClasses: 0, basicsMonths: 0 };
  assert.equal(danceProgress('WCS', [], undefined, false, zero, '2026-11-18').ready, true);
  assert.equal(danceProgress('WCS', [], undefined, false, { ...zero, basicsMonths: 1 }, '2026-11-18').ready, false);
});
