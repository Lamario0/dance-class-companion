// Slice 4: which links open a check-in in the Android app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { slotFromLink } = await import('../services/appLinks.ts');

test('class check-in links give their slot; anything else gives null', () => {
  assert.equal(slotFromLink('https://danceclasscompanion.com/checkin/eZpAJDOPpYiyqvg2DoLM'), 'eZpAJDOPpYiyqvg2DoLM');
  assert.equal(slotFromLink('https://danceclasscompanion.com/checkin/tue7-1/'), 'tue7-1');
  assert.equal(slotFromLink('  https://www.danceclasscompanion.com/checkin/abc  '), 'abc');
  for (const bad of [
    'http://danceclasscompanion.com/checkin/abc',
    'https://evil.example/checkin/abc',
    'https://danceclasscompanion.com.evil.example/checkin/abc',
    'https://danceclasscompanion.com/',
    'https://danceclasscompanion.com/checkin/',
    'https://danceclasscompanion.com/checkin/a/b',
    'https://danceclasscompanion.com/checkin/' + 'x'.repeat(65),
    'https://danceclasscompanion.com/checkin/a%20b',
    'WIFI:S:studio;T:WPA;P:secret;;',
    'not a url',
  ]) assert.equal(slotFromLink(bad), null, bad);
});
