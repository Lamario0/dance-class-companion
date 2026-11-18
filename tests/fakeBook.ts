// An in-memory Google Sheets workbook for the sheet tests (never touches Google).
import type { SheetsApi } from '../netlify/lib/sheets.mts';

const colIndex = (l: string) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class FakeBook implements SheetsApi {
  grids = new Map<string, string[][]>();
  row1 = new Map<string, { text: string; checkbox: boolean }[]>();
  ids = new Map<string, number>();
  failing = false;
  /** every call waits this long first (a slow sheet) */
  delayMs = 0;
  writes = 0;
  rawWrites = 0;

  grid(name: string) {
    if (!this.grids.has(name)) this.grids.set(name, []);
    if (!this.ids.has(name)) this.ids.set(name, 1000 + this.ids.size);
    return this.grids.get(name)!;
  }
  private parse(range: string) {
    const m = /^(?:'((?:[^']|'')+)'|([^!]+))!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range)!;
    return { sheet: (m[1] ?? m[2]).replace(/''/g, "'"), c0: colIndex(m[3]), r0: m[4] ? +m[4] - 1 : 0, c1: colIndex(m[5] ?? m[3]), r1: m[6] ? +m[6] - 1 : Infinity };
  }
  private async check() {
    if (this.delayMs) await sleep(this.delayMs);
    if (this.failing) throw new Error('sheet down');
  }
  async get(range: string, mode: 'formatted' | 'formula' | 'unformatted' = 'formatted') {
    await this.check();
    const { sheet, c0, r0, c1, r1 } = this.parse(range);
    const g = this.grid(sheet);
    const out: string[][] = [];
    for (let r = r0; r < Math.min(g.length, r1 + 1); r++) {
      out.push((g[r] ?? []).slice(c0, c1 + 1).map(v => (mode !== 'formula' && v?.startsWith('=') ? '(computed)' : (v ?? ''))));
    }
    // Like the API: trailing empty rows are left out.
    while (out.length && !out[out.length - 1].some(Boolean)) out.pop();
    return out;
  }
  async update(range: string, rows: (string | boolean)[][], asText = false) {
    await this.check();
    this.writes++;
    if (asText) this.rawWrites++;
    const { sheet, c0, r0 } = this.parse(range);
    const g = this.grid(sheet);
    rows.forEach((row, i) => {
      g[r0 + i] = g[r0 + i] ?? [];
      row.forEach((v, j) => (g[r0 + i][c0 + j] = String(v)));
    });
  }
  async append(range: string, rows: (string | boolean)[][], asText = false) {
    await this.check();
    this.writes++;
    if (asText) this.rawWrites++;
    const { sheet } = this.parse(range);
    const g = this.grid(sheet);
    let last = g.length;
    while (last > 0 && !(g[last - 1] ?? []).some(Boolean)) last--;
    rows.forEach((row, i) => (g[last + i] = row.map(String)));
  }
  async meta() {
    await this.check();
    const titles = new Set([...this.grids.keys(), ...this.row1.keys()]);
    return [...titles].map(title => {
      this.grid(title);
      return { title, sheetId: this.ids.get(title)!, row1: this.row1.get(title) ?? [] };
    });
  }
  async batch(requests: any[]) {
    await this.check();
    this.writes++;
    const byId = (id: number) => this.grid([...this.ids].find(([, v]) => v === id)![0]);
    for (const r of requests) {
      if (r.insertDimension) {
        const { sheetId, startIndex, endIndex } = r.insertDimension.range;
        const g = byId(sheetId);
        while (g.length < startIndex) g.push([]);
        g.splice(startIndex, 0, ...Array.from({ length: endIndex - startIndex }, () => [] as string[]));
      } else if (r.deleteDimension) {
        const { sheetId, startIndex, endIndex } = r.deleteDimension.range;
        byId(sheetId).splice(startIndex, endIndex - startIndex);
      } else if (r.updateCells) {
        const { start, rows } = r.updateCells;
        const g = byId(start.sheetId);
        rows.forEach((row: any, i: number) => {
          const at = start.rowIndex + i;
          while (g.length <= at) g.push([]);
          g[at] = g[at] ?? [];
          row.values.forEach((c: any, j: number) => {
            const v = c.userEnteredValue;
            g[at][start.columnIndex + j] = v?.stringValue ?? (v?.numberValue !== undefined ? String(v.numberValue) : '');
          });
        });
      } else throw new Error(`fake: unsupported request ${Object.keys(r)[0]}`);
    }
  }
  slotRow(id: string) {
    return this.grid('Slots').find(r => r[3] === id);
  }
  /** Attendance rows from row 2, as [date serial, time, slot, class, name, how, guest, id]. */
  attendance() {
    return this.grid('Attendance').slice(1).filter(r => r?.some(Boolean));
  }
}
