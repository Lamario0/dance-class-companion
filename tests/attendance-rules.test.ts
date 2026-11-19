// Firestore rules for slots and check-ins (attendance slice 1, criterion 7). Needs: npm run emulators
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dcc-attendance',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'slots/tue7'), { label: 'Tue 7:00pm', title: 'WCS 201', archived: false, createdAt: Timestamp.now() });
    await setDoc(doc(db, 'checkins/tue7__2026-11-17__alice'), { uid: 'alice', name: 'Alice', slotId: 'tue7', title: 'WCS 201', date: '2026-11-17' });
    await setDoc(doc(db, 'checkins/tue7__2026-11-17__bob'), { uid: 'bob', name: 'Bob', slotId: 'tue7', title: 'WCS 201', date: '2026-11-17' });
  });
});

const admin = () => env.authenticatedContext('boss', { email_verified: true, admin: true }).firestore();
const unverifiedAdmin = () => env.authenticatedContext('eve', { email_verified: false, admin: true }).firestore();
const alice = () => env.authenticatedContext('alice', { email_verified: true }).firestore();
const guest = () => env.unauthenticatedContext().firestore();
const newSlot = (over: Record<string, unknown> = {}) => ({ label: 'Thu 8:00pm', title: 'WCS 101', archived: false, createdAt: serverTimestamp(), ...over });

test('guests (slice 2): only verified admins read, create (valid fields) and rename; nobody deletes', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'guests/wendy'), { name: 'Wendy', createdAt: Timestamp.now(), createdBy: 'boss' });
    await setDoc(doc(ctx.firestore(), 'checkins/tue7__2026-11-17__g_wendy'), { guestId: 'wendy', name: 'Wendy', slotId: 'tue7', date: '2026-11-17' });
  });
  const newGuest = (over: Record<string, unknown> = {}) => ({ name: 'Sam', createdAt: serverTimestamp(), createdBy: 'boss', ...over });
  await assertSucceeds(addDoc(collection(admin(), 'guests'), newGuest()));
  await assertFails(addDoc(collection(admin(), 'guests'), newGuest({ name: '  ' })));
  await assertFails(addDoc(collection(admin(), 'guests'), newGuest({ name: 'x'.repeat(61) })));
  await assertFails(addDoc(collection(admin(), 'guests'), newGuest({ createdBy: 'someone-else' })));
  await assertFails(addDoc(collection(admin(), 'guests'), newGuest({ extra: 1 })));
  await assertFails(addDoc(collection(alice(), 'guests'), newGuest({ createdBy: 'alice' })));
  await assertFails(addDoc(collection(unverifiedAdmin(), 'guests'), newGuest({ createdBy: 'eve' })));
  await assertSucceeds(getDocs(collection(admin(), 'guests')));
  await assertFails(getDocs(collection(alice(), 'guests')));
  await assertFails(getDoc(doc(guest(), 'guests/wendy')));
  await assertSucceeds(updateDoc(doc(admin(), 'guests/wendy'), { name: 'Wendy K.' }));
  await assertFails(updateDoc(doc(admin(), 'guests/wendy'), { createdBy: 'x' }));
  await assertFails(updateDoc(doc(alice(), 'guests/wendy'), { name: 'Hacked' }));
  await assertFails(deleteDoc(doc(admin(), 'guests/wendy')));
  // Guest check-ins (no uid): admins read them by date; students can't.
  await assertSucceeds(getDocs(query(collection(admin(), 'checkins'), where('date', '==', '2026-11-17'))));
  await assertFails(getDoc(doc(alice(), 'checkins/tue7__2026-11-17__g_wendy')));
  await assertSucceeds(getDocs(query(collection(alice(), 'checkins'), where('uid', '==', 'alice'))));
});

test('anyone can read a slot (QR landing screen)', async () => {
  await assertSucceeds(getDoc(doc(guest(), 'slots/tue7')));
});
test('only verified admins create slots, with valid fields', async () => {
  await assertSucceeds(addDoc(collection(admin(), 'slots'), newSlot()));
  await assertFails(addDoc(collection(alice(), 'slots'), newSlot()));
  await assertFails(addDoc(collection(unverifiedAdmin(), 'slots'), newSlot()));
  await assertFails(addDoc(collection(admin(), 'slots'), newSlot({ title: '' })));
  await assertFails(addDoc(collection(admin(), 'slots'), newSlot({ archived: true })));
  await assertFails(addDoc(collection(admin(), 'slots'), newSlot({ extra: 1 })));
});
test('admins edit the title/label and archive; nobody deletes', async () => {
  await assertSucceeds(updateDoc(doc(admin(), 'slots/tue7'), { title: 'WCS 301' }));
  await assertSucceeds(updateDoc(doc(admin(), 'slots/tue7'), { archived: true }));
  await assertFails(updateDoc(doc(admin(), 'slots/tue7'), { createdAt: Timestamp.now() }));
  await assertFails(updateDoc(doc(alice(), 'slots/tue7'), { title: 'Hacked' }));
  await assertFails(deleteDoc(doc(admin(), 'slots/tue7')));
});
test('nobody writes check-ins from the browser', async () => {
  await assertFails(setDoc(doc(alice(), 'checkins/tue7__2026-11-18__alice'), { uid: 'alice' }));
  await assertFails(setDoc(doc(admin(), 'checkins/tue7__2026-11-18__x'), { uid: 'x' }));
  await assertFails(deleteDoc(doc(alice(), 'checkins/tue7__2026-11-17__alice')));
});
test('a student reads only their own check-ins', async () => {
  await assertSucceeds(getDoc(doc(alice(), 'checkins/tue7__2026-11-17__alice')));
  await assertFails(getDoc(doc(alice(), 'checkins/tue7__2026-11-17__bob')));
  await assertSucceeds(getDocs(query(collection(alice(), 'checkins'), where('uid', '==', 'alice'))));
  await assertFails(getDocs(collection(alice(), 'checkins')));
  await assertFails(getDoc(doc(guest(), 'checkins/tue7__2026-11-17__alice')));
});
test('admins read all check-ins', async () => {
  await assertSucceeds(getDocs(collection(admin(), 'checkins')));
});

test('levels (slice 5): a student reads only their own, admins read all, nobody writes; anyone signed in reads the targets', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'levels/alice'), { dances: { WCS: { level: '100', cap: null } } });
    await setDoc(doc(ctx.firestore(), 'levels/bob'), { dances: { WCS: { level: '200', cap: null } } });
    await setDoc(doc(ctx.firestore(), 'settings/levels'), { basicsClasses: 12 });
  });
  await assertSucceeds(getDoc(doc(alice(), 'levels/alice')));
  await assertFails(getDoc(doc(alice(), 'levels/bob')));
  await assertSucceeds(getDoc(doc(admin(), 'levels/bob')));
  await assertFails(getDoc(doc(guest(), 'levels/alice')));
  await assertFails(setDoc(doc(alice(), 'levels/alice'), { dances: { WCS: { level: 'ADV', cap: null } } }));
  await assertFails(updateDoc(doc(alice(), 'levels/alice'), { 'dances.WCS.level': 'ADV' }));
  await assertFails(setDoc(doc(admin(), 'levels/alice'), { dances: { WCS: { level: 'ADV', cap: null } } }));
  await assertSucceeds(getDoc(doc(alice(), 'settings/levels')));
  await assertFails(getDoc(doc(guest(), 'settings/levels')));
  await assertFails(setDoc(doc(admin(), 'settings/levels'), { basicsClasses: 1 }));
  await assertFails(getDoc(doc(alice(), 'settings/other')));
});
