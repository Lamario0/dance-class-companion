// The real Google client (netlify/lib/sheets.mts) against a stand-in for Google's
// HTTP API that behaves like the real one where it matters: a range with no sheet
// name ("1:1") means the FIRST worksheet only. No network, no emulators.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  client_email: 'test@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
});
const { sheetsApi, setSheetsApiForTests } = await import('../netlify/lib/sheets.mts');
setSheetsApiForTests(undefined);

const SHEETS = [
  { title: 'Carolina Shag', sheetId: 1, row1: [{ v: 'AB' }, { v: '101' }] },
  { title: 'WCS', sheetId: 2, row1: [{ v: 'Basics 101-A' }, { v: 'FALSE', box: true }] },
  { title: 'Attendance', sheetId: 3, row1: [{ v: 'Date' }] },
];
const realFetch = globalThis.fetch;
const seen: string[] = [];
globalThis.fetch = (async (input: any) => {
  const url = new URL(String(input));
  seen.push(url.toString());
  if (url.host === 'oauth2.googleapis.com') return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
  const ranges = url.searchParams.getAll('ranges');
  const pick = ranges.length
    ? SHEETS.filter((s, i) => ranges.some(r => (r.includes('!') ? r.split('!')[0].replace(/^'|'$/g, '') === s.title : i === 0)))
    : SHEETS;
  const grid = url.searchParams.get('includeGridData') === 'true';
  return new Response(
    JSON.stringify({
      sheets: pick.map(s => ({
        properties: { title: s.title, sheetId: s.sheetId },
        ...(grid ? { data: [{ rowData: [{ values: s.row1.map(c => ({ formattedValue: c.v, ...(c.box ? { dataValidation: { condition: { type: 'BOOLEAN' } } } : {}) })) }] }] } : {}),
      })),
    }),
  );
}) as typeof fetch;
after(() => {
  globalThis.fetch = realFetch;
});

test('meta() sees every worksheet and each one\'s row 1 (not just the first)', async () => {
  const api = sheetsApi()!;
  const meta = await api.meta();
  assert.deepEqual(meta.map(m => m.title), ['Carolina Shag', 'WCS', 'Attendance']);
  assert.equal(meta.find(m => m.title === 'Attendance')!.sheetId, 3);
  assert.deepEqual(meta.find(m => m.title === 'WCS')!.row1, [
    { text: 'Basics 101-A', checkbox: false },
    { text: 'FALSE', checkbox: true },
  ]);
  const asked = seen.flatMap(u => new URL(u).searchParams.getAll('ranges'));
  assert.ok(asked.includes("'Carolina Shag'!1:1"), 'names with spaces are quoted');
  const light = await api.meta(false);
  assert.deepEqual(light.map(m => [m.title, m.sheetId]), [['Carolina Shag', 1], ['WCS', 2], ['Attendance', 3]]);
});
