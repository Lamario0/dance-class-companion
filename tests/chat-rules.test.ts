// Firestore rules for chat identity (spec slice 3, criteria 3, 4, 7, 10). Needs: npm run emulators
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dcc-chat',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice', createdAt: Timestamp.now() });
    await setDoc(doc(db, 'users/boss'), { displayName: 'Boss', createdAt: Timestamp.now() });
    await setDoc(doc(db, 'chatMessages/aliceMsg'), { ...stored(), author: 'Alice', uid: 'alice', role: 'member' });
    await setDoc(doc(db, 'chatMessages/guestMsg'), { ...stored(), author: 'Old Guest' }); // pre-slice-3 format
  });
});

const now = new Date();
const quarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
const expireAt = () => Timestamp.fromDate(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1));
const stored = () => ({ author: 'X', text: 'hello', parentId: null, quarter, createdAt: Timestamp.now(), expireAt: expireAt() });
const post = (over: Record<string, unknown> = {}) => ({ author: 'Alice', text: 'hi', parentId: null, quarter, createdAt: serverTimestamp(), expireAt: expireAt(), ...over });

const alice = () => env.authenticatedContext('alice', { email_verified: true }).firestore();
const aliceUnverified = () => env.authenticatedContext('alice', { email_verified: false }).firestore();
const bob = () => env.authenticatedContext('bob', { email_verified: true }).firestore();
const boss = () => env.authenticatedContext('boss', { email_verified: true, admin: true }).firestore();
const guest = () => env.unauthenticatedContext().firestore();
const msgs = (db: ReturnType<typeof guest>) => collection(db, 'chatMessages');

// --- posting ---
test('guests post as before', async () => { await assertSucceeds(addDoc(msgs(guest()), post({ author: 'Any Name' }))); });
test('guests cannot attach a uid or role', async () => {
  await assertFails(addDoc(msgs(guest()), post({ uid: 'alice', role: 'member' })));
  await assertFails(addDoc(msgs(guest()), post({ role: 'admin' })));
});
test('a member posts under their profile name', async () => { await assertSucceeds(addDoc(msgs(alice()), post({ uid: 'alice', role: 'member' }))); });
test('a member cannot post under another name, another uid, or as admin', async () => {
  await assertFails(addDoc(msgs(alice()), post({ author: 'Boss', uid: 'alice', role: 'member' })));
  await assertFails(addDoc(msgs(alice()), post({ uid: 'bob', role: 'member' })));
  await assertFails(addDoc(msgs(alice()), post({ uid: 'alice', role: 'admin' })));
});
test('an unverified account can only post as a guest', async () => {
  await assertFails(addDoc(msgs(aliceUnverified()), post({ uid: 'alice', role: 'member' })));
  await assertSucceeds(addDoc(msgs(aliceUnverified()), post({ author: 'Alice' })));
});
test('an admin posts with the admin tag, and only with it', async () => {
  await assertSucceeds(addDoc(msgs(boss()), post({ author: 'Boss', uid: 'boss', role: 'admin' })));
  await assertFails(addDoc(msgs(boss()), post({ author: 'Boss', uid: 'boss', role: 'member' })));
});
test('"Studio Admin" stays reserved', () => assertFails(addDoc(msgs(guest()), post({ author: 'studio admin' }))));

// --- editing ---
const edit = (text = 'edited') => ({ text, editedAt: serverTimestamp() });
test('a member edits their own message', () => assertSucceeds(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), edit())));
test('a member cannot edit someone else\'s or an old guest message', async () => {
  await assertFails(updateDoc(doc(bob(), 'chatMessages/aliceMsg'), edit()));
  await assertFails(updateDoc(doc(alice(), 'chatMessages/guestMsg'), edit()));
  await assertFails(updateDoc(doc(guest(), 'chatMessages/guestMsg'), edit()));
});
test('edits cannot change the author, uid or role', async () => {
  await assertFails(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), { ...edit(), author: 'Boss' }));
  await assertFails(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), { ...edit(), role: 'admin' }));
  await assertFails(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), { text: 'no timestamp' }));
  await assertFails(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), edit('x'.repeat(1001))));
});

// --- deleting ---
const softDelete = { text: '', deleted: true, editedAt: serverTimestamp() };
test('a member soft-deletes or deletes their own message', async () => {
  await assertSucceeds(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), softDelete));
  await assertFails(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), edit('back from the dead')));
  await assertSucceeds(deleteDoc(doc(alice(), 'chatMessages/aliceMsg')));
});
test('others cannot delete a member\'s message', async () => {
  await assertFails(deleteDoc(doc(bob(), 'chatMessages/aliceMsg')));
  await assertFails(updateDoc(doc(bob(), 'chatMessages/aliceMsg'), softDelete));
  await assertFails(deleteDoc(doc(guest(), 'chatMessages/guestMsg')));
});

// --- renaming ---
test('a rename follows the profile name only', async () => {
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'users/alice'), { displayName: 'Ali' }));
  await assertSucceeds(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), { author: 'Ali' }));
  await assertFails(updateDoc(doc(alice(), 'chatMessages/aliceMsg'), { author: 'Someone Else' }));
});

// --- admins ---
test('an admin edits, soft-deletes and deletes any message', async () => {
  await assertSucceeds(updateDoc(doc(boss(), 'chatMessages/guestMsg'), edit('tidied up')));
  await assertSucceeds(updateDoc(doc(boss(), 'chatMessages/aliceMsg'), softDelete));
  await assertSucceeds(deleteDoc(doc(boss(), 'chatMessages/guestMsg')));
});
test('an admin cannot rewrite who wrote a message', () =>
  assertFails(updateDoc(doc(boss(), 'chatMessages/aliceMsg'), { author: 'Boss' })));
test('a fake admin claim needs a verified account', () =>
  assertFails(deleteDoc(doc(env.authenticatedContext('eve', { email_verified: false, admin: true }).firestore(), 'chatMessages/guestMsg'))));
