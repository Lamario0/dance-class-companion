// Firestore rules checks (spec slice 1, criterion 9). Needs the emulators: npm run emulators
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dcc-rules',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const guest = () => env.unauthenticatedContext().firestore();
const profile = (name = 'Alice') => ({ displayName: name, createdAt: serverTimestamp() });

const seedAlice = () =>
  env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/alice'), { displayName: 'Alice', createdAt: Timestamp.now() }));

test('a student can create their own profile', () => assertSucceeds(setDoc(doc(alice(), 'users/alice'), profile())));
test('a student cannot create someone else\'s profile', () => assertFails(setDoc(doc(bob(), 'users/alice'), profile())));
test('guests cannot create profiles', () => assertFails(setDoc(doc(guest(), 'users/alice'), profile())));
test('a profile cannot carry a role field', () =>
  assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile(), admin: true })));
test('a profile cannot carry a fake createdAt', () =>
  assertFails(setDoc(doc(alice(), 'users/alice'), { displayName: 'Alice', createdAt: Timestamp.fromDate(new Date(2020, 0, 1)) })));
test('names must be 1-40 characters', async () => {
  await assertFails(setDoc(doc(alice(), 'users/alice'), profile('   ')));
  await assertFails(setDoc(doc(alice(), 'users/alice'), profile('x'.repeat(41))));
});

test('a student can read their own profile', async () => {
  await seedAlice();
  await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
});
test('other students and guests cannot read it', async () => {
  await seedAlice();
  await assertFails(getDoc(doc(bob(), 'users/alice')));
  await assertFails(getDoc(doc(guest(), 'users/alice')));
});
test('a student can rename themselves', async () => {
  await seedAlice();
  await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { displayName: 'Ali' }));
});
test('a student cannot add a role or change createdAt', async () => {
  await seedAlice();
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { admin: true }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { createdAt: Timestamp.now() }));
});
test('nobody can rename someone else', async () => {
  await seedAlice();
  await assertFails(updateDoc(doc(bob(), 'users/alice'), { displayName: 'Hacked' }));
});
test('profiles cannot be deleted from the browser', async () => {
  await seedAlice();
  await assertFails(deleteDoc(doc(alice(), 'users/alice')));
});

// Regression: the chat rules still work as before.
test('guests can still post in chat', async () => {
  const now = new Date();
  await assertSucceeds(
    addDoc(collection(guest(), 'chatMessages'), {
      author: 'Guest',
      text: 'hi',
      parentId: null,
      quarter: `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`,
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromDate(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1)),
    }),
  );
});
