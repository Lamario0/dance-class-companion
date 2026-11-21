// Home-screen class cards: one per active slot, in the order given (no emulators).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotCards } from '../services/dataService.ts';
import { sortSlots } from '../services/slotOrder.ts';

const classes = new Map([
  ['Basics 101-A', { dance: 'WCS', title: 'Basics 101-A', patterns: ['Sugar Push', 'Left Side Pass'], notes: 'Bring water' }],
  ['ADV Concepts 6', { dance: 'WCS', title: 'ADV Concepts 6', patterns: [], notes: '' }],
]);

test('five active slots make five cards, in the admin order; archived ones make none', () => {
  const slots = sortSlots([
    { id: 'a', label: 'Tue 6:00pm', title: 'ADV Concepts 6', archived: false, order: 2 },
    { id: 'b', label: 'Tue 7:00pm', title: 'Basics 101-A', archived: false, order: 0 },
    { id: 'c', label: 'Tue 8:00pm', title: 'Not in the sheet', archived: false, order: 1 },
    { id: 'd', label: 'Wed 7:00pm', title: 'Basics 101-A', archived: false },
    { id: 'e', label: 'Old', title: 'Basics 101-A', archived: true, order: 3 },
    { id: 'f', label: 'Thu 7:00pm', title: '**Musicality**', archived: false },
  ]);
  const cards = slotCards(slots, classes);
  assert.deepEqual(cards.map(c => c.id), ['slot-b', 'slot-c', 'slot-a', 'slot-d', 'slot-f']);
  assert.deepEqual([cards[0].when, cards[0].content, cards[0].notes], ['Tue 7:00pm', 'Sugar Push, Left Side Pass', 'Bring water']);
  // A class with no patterns (or not in the Classes worksheet) still gets its card.
  assert.equal(cards[1].content, 'Patterns TBD');
  assert.equal(cards[2].content, 'Patterns TBD');
  assert.equal(cards[4].name, 'Musicality');
});

test('no active slots, no cards', () => {
  assert.deepEqual(slotCards([{ id: 'x', label: 'Old', title: 'Basics 101-A', archived: true }], classes), []);
});
