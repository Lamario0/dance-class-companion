// Slots and Classes worksheets <-> the app (attendance slice 3A, docs/spec.md).
//
// Slots (Slot | Class | Archived | Slot ID): one row per slot, written by the app.
// The label and class can be edited in the sheet; the sheet wins unless the app
// has an edit that hasn't reached the sheet yet (`sheetPending` on the slot).
// Archived is the app's.
//
// Classes (Dance | Class | Patterns covered | Notes | Column): one row per class
// column of each dance worksheet, as live formulas. refreshClasses() only adds
// rows for columns that have none; it never edits or deletes a row (Notes are
// typed by hand).
import type { Firestore } from 'firebase-admin/firestore';
import { NOT_DANCE, colLetter, sheetRef, withTimeout, type SheetsApi } from './sheets.mts';

export interface SlotValues {
  label: string;
  title: string;
  archived: boolean;
}

export const MAX_SLOT_TEXT = 60;
export const isSlotText = (t: unknown): t is string => typeof t === 'string' && t.trim().length > 0 && t.length <= MAX_SLOT_TEXT;

/** Sheet text typed by the app must never turn into a formula. */
const plain = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);

const slotRow = (id: string, s: SlotValues) => [plain(s.label), plain(s.title), s.archived ? 'yes' : '', id];

interface SheetSlot extends SlotValues {
  id: string;
  row: number;
}

export const readSlotRows = async (api: SheetsApi): Promise<SheetSlot[]> =>
  (await api.get('Slots!A2:D'))
    .map((r, i) => ({
      id: (r[3] ?? '').trim(),
      label: (r[0] ?? '').trim(),
      title: (r[1] ?? '').trim(),
      archived: /^(yes|true|x)$/i.test((r[2] ?? '').trim()),
      row: i + 2,
    }))
    .filter(r => r.id);

/** Create or update a slot's row in Slots. */
export const writeSlotRow = async (api: SheetsApi, id: string, s: SlotValues, rows?: SheetSlot[]) => {
  const existing = (rows ?? (await readSlotRows(api))).find(r => r.id === id);
  if (existing) await api.update(`Slots!A${existing.row}:D${existing.row}`, [slotRow(id, s)]);
  else await api.append('Slots!A:D', [slotRow(id, s)]);
};

/**
 * The slot's label and class as the sheet has them, for a check-in. Null when the
 * sheet isn't connected, is slow (2.5 s), has no row for it, or the row is unusable.
 */
export const sheetSlot = async (api: SheetsApi | null, id: string): Promise<{ label: string; title: string } | null> => {
  if (!api) return null;
  try {
    const row = (await withTimeout(readSlotRows(api), 2500)).find(r => r.id === id);
    return row && isSlotText(row.label) && isSlotText(row.title) ? { label: row.label, title: row.title } : null;
  } catch (err) {
    console.warn('sheet read at check-in failed; using the app title', err);
    return null;
  }
};

/** Two-way slot sync: push pending/missing rows, pull sheet edits (sheet wins). */
export const syncSlots = async (api: SheetsApi, db: Firestore) => {
  const rows = await readSlotRows(api);
  const byId = new Map(rows.map(r => [r.id, r]));
  const snaps = (await db.collection('slots').get()).docs;
  let pushed = 0;
  let pulled = 0;
  for (const snap of snaps) {
    const d = snap.data();
    if (typeof d.label !== 'string' || typeof d.title !== 'string') continue;
    const app: SlotValues = { label: d.label, title: d.title, archived: d.archived === true };
    const row = byId.get(snap.id);
    if (d.sheetPending === true || !row) {
      await writeSlotRow(api, snap.id, app, rows);
      if (!row) rows.push({ id: snap.id, ...app, row: Math.max(1, ...rows.map(r => r.row)) + 1 });
      // Only clears the flag if nobody edited the slot meanwhile.
      if (d.sheetPending === true) await snap.ref.update({ sheetPending: false }, { lastUpdateTime: snap.updateTime }).catch(() => {});
      pushed++;
      continue;
    }
    const label = isSlotText(row.label) ? row.label : app.label;
    const title = isSlotText(row.title) ? row.title : app.title;
    if (label !== app.label || title !== app.title) {
      // Precondition: an app edit made after we read the slot wins.
      const ok = await snap.ref.update({ label, title }, { lastUpdateTime: snap.updateTime }).then(() => true, () => false);
      if (ok) pulled++;
    }
    if (row.archived !== app.archived || label !== row.label || title !== row.title) {
      await writeSlotRow(api, snap.id, { label, title, archived: app.archived }, rows);
    }
  }
  return { pushed, pulled };
};

// --- Classes -------------------------------------------------------------------

/** The class columns of every dance worksheet: a column whose right-hand neighbour in row 1 is a checkbox. */
export const classColumns = (meta: Awaited<ReturnType<SheetsApi['meta']>>) => {
  const out: { sheet: string; col: number }[] = [];
  for (const s of meta) {
    if (NOT_DANCE.includes(s.title.trim().toLowerCase())) continue;
    s.row1.forEach((cell, i) => {
      if (!cell.checkbox && s.row1[i + 1]?.checkbox) out.push({ sheet: s.title, col: i });
    });
  }
  return out;
};

const REF = /^=\s*(?:'((?:[^']|'')+)'|([A-Za-z0-9_]+))!\$?([A-Z]{1,3})\$?1\s*$/;

/** The Classes row formulas for one class column (same formulas as the rows set up by hand). */
export const classRow = (sheet: string, col: number) => {
  const ref = sheetRef(sheet);
  const t = colLetter(col);
  const k = colLetter(col + 1);
  return [
    plain(sheet),
    `=${ref}!${t}1`,
    `=IFERROR(LET(c,${ref}!${t}2:${t},k,${ref}!${k}2:${k},b,IFERROR(MATCH("Technique",c,0),IFERROR(MATCH("Basic Patterns or Technique",c,0),ROWS(c)+1)),TEXTJOIN(", ",TRUE,FILTER(TRIM(c),k=TRUE,SEQUENCE(ROWS(c))<b))),"")`,
    '',
    `=SUBSTITUTE(ADDRESS(1,COLUMN(${ref}!${t}1),4),"1","")`,
  ];
};

/** Add a Classes row for each class column that has none. Returns how many were added. */
export const refreshClasses = async (api: SheetsApi) => {
  const have = new Set<string>();
  for (const [f] of await api.get('Classes!B2:B', true)) {
    const m = REF.exec(f ?? '');
    if (m) have.add(`${(m[1] ?? m[2]).replace(/''/g, "'")}!${m[3]}`);
  }
  const missing = classColumns(await api.meta()).filter(c => !have.has(`${c.sheet}!${colLetter(c.col)}`));
  if (missing.length) await api.append('Classes!A:E', missing.map(c => classRow(c.sheet, c.col)));
  return { added: missing.length };
};

/** Everything the 15-minute job and the admin button do. */
export const syncSheet = async (api: SheetsApi, db: Firestore) => {
  const slots = await syncSlots(api, db);
  const classes = await refreshClasses(api);
  return { slots, classes };
};
