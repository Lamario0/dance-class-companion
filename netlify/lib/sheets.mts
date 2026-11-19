// Google Sheets access for the server (attendance slice 3, docs/spec.md).
// The Syllabus workbook is shared with the service account (FIREBASE_SERVICE_ACCOUNT)
// as Editor. Only Slots, Classes and Attendance are written here; "webapp data",
// the dance worksheets and "Random Notes" are only read.
//
// Tests swap in an in-memory workbook with setSheetsApiForTests().
import { createSign } from 'node:crypto';

export const SPREADSHEET_ID = process.env['DCC_SHEET_ID'] || '1VuTfGDldybCC8Lv0FSQG8acMSQ681X93NgUVAXg89Ls';

/** Worksheets that are never dance worksheets. */
export const NOT_DANCE = ['webapp data', 'random notes', 'classes', 'slots', 'attendance'];

export interface SheetMeta {
  title: string;
  sheetId: number;
  /** Row 1, one entry per column: the text and whether the cell is a checkbox. */
  row1: { text: string; checkbox: boolean }[];
}

/** The few Sheets calls the app needs. */
export interface SheetsApi {
  /** Values of a range: as shown ('formatted'), formulas, or 'unformatted' (dates as serial numbers). */
  get(range: string, mode?: 'formatted' | 'formula' | 'unformatted'): Promise<string[][]>;
  /** Overwrite a range. `asText`: stored exactly as given (RAW); otherwise as typed, so formulas work. */
  update(range: string, rows: (string | boolean)[][], asText?: boolean): Promise<void>;
  /** Add rows after the last row of the worksheet holding `range`. */
  append(range: string, rows: (string | boolean)[][], asText?: boolean): Promise<void>;
  /** Every worksheet's title, id and row 1. */
  meta(): Promise<SheetMeta[]>;
  /** spreadsheets.batchUpdate: all the requests apply together, in order, or none do. */
  batch(requests: object[]): Promise<void>;
}

// After a failed or slow sheet call, check-ins skip the sheet for a minute so a
// sheet outage never makes every scan wait (the job catches up).
let downUntil = 0;
export const noteSheetDown = () => {
  downUntil = Date.now() + 60_000;
};
export const sheetLooksDown = () => Date.now() < downUntil;
/** Tests only. */
export const resetSheetDown = () => {
  downUntil = 0;
};

let testApi: SheetsApi | null | undefined;
/** Tests only: use this workbook instead of Google (null = "not configured"). */
export const setSheetsApiForTests = (api: SheetsApi | null | undefined) => {
  testApi = api;
  downUntil = 0;
};

/** The workbook, or null when no credentials are set (local dev on the emulators). */
export const sheetsApi = (): SheetsApi | null => {
  if (testApi !== undefined) return testApi;
  const raw = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!raw) return null;
  return googleApi(JSON.parse(raw));
};

// --- the real thing ----------------------------------------------------------

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');
let token: { value: string; until: number } | null = null;

const accessToken = async (sa: { client_email: string; private_key: string }) => {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claims}.${b64url(signature)}`,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, until: Date.now() + body.expires_in * 1000 };
  return token.value;
};

const googleApi = (sa: { client_email: string; private_key: string }): SheetsApi => {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(base + path, {
      ...init,
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Sheets API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<any>;
  };
  const enc = encodeURIComponent;
  return {
    async get(range, mode = 'formatted') {
      const render = mode === 'formula' ? 'FORMULA' : mode === 'unformatted' ? 'UNFORMATTED_VALUE' : 'FORMATTED_VALUE';
      const r = await call(`/values/${enc(range)}?valueRenderOption=${render}&dateTimeRenderOption=SERIAL_NUMBER`);
      return ((r.values ?? []) as unknown[][]).map(row => row.map(v => String(v ?? '')));
    },
    async update(range, rows, asText = false) {
      await call(`/values/${enc(range)}?valueInputOption=${asText ? 'RAW' : 'USER_ENTERED'}`, {
        method: 'PUT',
        body: JSON.stringify({ values: rows }),
      });
    },
    async append(range, rows, asText = false) {
      await call(`/values/${enc(range)}:append?valueInputOption=${asText ? 'RAW' : 'USER_ENTERED'}&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: JSON.stringify({ values: rows }),
      });
    },
    async meta() {
      const fields = 'sheets(properties(title,sheetId),data(rowData(values(formattedValue,dataValidation(condition(type))))))';
      const r = await call(`?includeGridData=true&ranges=${enc('1:1')}&fields=${enc(fields)}`);
      return (r.sheets ?? []).map((s: any) => ({
        title: s.properties.title as string,
        sheetId: s.properties.sheetId as number,
        row1: ((s.data?.[0]?.rowData?.[0]?.values ?? []) as any[]).map(v => ({
          text: String(v.formattedValue ?? ''),
          checkbox: v.dataValidation?.condition?.type === 'BOOLEAN',
        })),
      }));
    },
    async batch(requests) {
      if (requests.length) await call(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
    },
  };
};

// --- helpers -----------------------------------------------------------------

/** A1 column letters for a 0-based index. */
export const colLetter = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** A worksheet name as it appears in a formula: 'Carolina Shag'!A1, WCS!A1. */
export const sheetRef = (title: string) => (/^[A-Za-z0-9_]+$/.test(title) ? title : `'${title.replace(/'/g, "''")}'`);

/** Run `p`, giving up after `ms` (the sheet must never hold up a check-in). */
export const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
