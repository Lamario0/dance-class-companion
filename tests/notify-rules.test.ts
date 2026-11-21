// Slice 6 rules (criterion 8): devices and history are server-only; users set
// their own chatNotify and muted, nothing else. Needs: npm run emulators
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dcc-notify',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice', createdAt: Timestamp.now() });
    await setDoc(doc(db, 'pushTokens/t1'), { token: 'x'.repeat(30), platform: 'android', uid: 'alice' });
    await setDoc(doc(db, 'notifications/n1'), { title: 'Hi', body: 'There', audience: 'all', sentAt: Timestamp.now() });
  });
});

const admin = () => env.authenticatedContext('boss', { email_verified: true, admin: true }).firestore();
const alice = () => env.authenticatedContext('alice', { email_verified: true }).firestore();
const bob = () => env.authenticatedContext('bob', { email_verified: true }).firestore();
const guest = () => env.unauthenticatedContext().firestore();

test('push devices: nobody reads or writes them from the browser', async () => {
  for (const db of [admin(), alice(), guest()]) {
    await assertFails(getDoc(doc(db, 'pushTokens/t1')));
    await assertFails(setDoc(doc(db, 'pushTokens/t2'), { token: 'y'.repeat(30), platform: 'web', uid: null }));
  }
});

test('notification history: admins read; students and guests do not; nobody writes', async () => {
  await assertSucceeds(getDocs(collection(admin(), 'notifications')));
  await assertFails(getDoc(doc(alice(), 'notifications/n1')));
  await assertFails(getDoc(doc(guest(), 'notifications/n1')));
  await assertFails(setDoc(doc(admin(), 'notifications/n2'), { title: 'x', body: 'y', audience: 'all' }));
});

test('a user sets their own chat switch and mute list; not someone else\'s; bad values refused', async () => {
  await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { chatNotify: false }));
  await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { muted: [{ k: 'g:wendy', n: 'Wendy' }] }));
  await assertFails(updateDoc(doc(bob(), 'users/alice'), { chatNotify: true }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { chatNotify: 'no' }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { muted: 'everyone' }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { muted: Array.from({ length: 201 }, (_, i) => ({ k: `g:n${i}`, n: 'x' })) }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { admin: true }));
});
