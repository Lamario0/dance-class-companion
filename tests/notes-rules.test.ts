// Firestore rules for notes (spec slice 2, criteria 2 and 9). Needs the emulators: npm run emulators
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dcc-notes',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const verified = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const unverified = (uid: string) => env.authenticatedContext(uid, { email_verified: false }).firestore();
const guest = () => env.unauthenticatedContext().firestore();

const classNote = (over: Record<string, unknown> = {}) => ({
  kind: 'class',
  classKey: 'wcs-201',
  className: 'WCS 201',
  pattern: 'Sugar Push',
  weekOf: '2026-11-16',
  title: '',
  body: 'Anchor on 5-6',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});
const freeNote = (over: Record<string, unknown> = {}) => ({
  ...classNote({ kind: 'free', classKey: '', className: '', pattern: '', weekOf: '', title: 'Ideas' }),
  ...over,
});
const CLASS_ID = 'users/alice/notes/wcs-201__2026-11-16';

const seed = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(ctx =>
    setDoc(doc(ctx.firestore(), path), { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }),
  );

test('a verified student can write a class note for this week', () => assertSucceeds(setDoc(doc(verified('alice'), CLASS_ID), classNote())));
test('a verified student can write a free note', () => assertSucceeds(setDoc(doc(verified('alice'), 'users/alice/notes/abc123'), freeNote())));
test('an unverified email account cannot write or read notes', async () => {
  await assertFails(setDoc(doc(unverified('alice'), CLASS_ID), classNote()));
  await seed(CLASS_ID, classNote());
  await assertFails(getDoc(doc(unverified('alice'), CLASS_ID)));
});
test('guests and other students cannot read, write or list', async () => {
  await seed(CLASS_ID, classNote());
  await assertFails(getDoc(doc(guest(), CLASS_ID)));
  await assertFails(getDoc(doc(verified('bob'), CLASS_ID)));
  await assertFails(getDocs(collection(verified('bob'), 'users/alice/notes')));
  await assertFails(setDoc(doc(verified('bob'), 'users/alice/notes/x'), freeNote()));
});
test('the owner can list their notes', async () => {
  await seed(CLASS_ID, classNote());
  await assertSucceeds(getDocs(collection(verified('alice'), 'users/alice/notes')));
});
test('class note ids must be <classKey>__<weekOf> (one per class per week)', async () => {
  await assertFails(setDoc(doc(verified('alice'), 'users/alice/notes/random-id'), classNote()));
  await assertFails(setDoc(doc(verified('alice'), 'users/alice/notes/wcs-201__2026-11-23'), classNote()));
  await assertFails(setDoc(doc(verified('alice'), 'users/alice/notes/wcs-201__nope'), classNote({ weekOf: 'nope' })));
});
test('sizes and fields are validated', async () => {
  await assertFails(setDoc(doc(verified('alice'), CLASS_ID), classNote({ body: 'x'.repeat(10001) })));
  await assertFails(setDoc(doc(verified('alice'), CLASS_ID), classNote({ title: 'x'.repeat(81) })));
  await assertFails(setDoc(doc(verified('alice'), CLASS_ID), classNote({ kind: 'secret' })));
  await assertFails(setDoc(doc(verified('alice'), CLASS_ID), classNote({ shared: true })));
  await assertFails(setDoc(doc(verified('alice'), CLASS_ID), classNote({ createdAt: Timestamp.fromDate(new Date(2020, 0, 1)) })));
});
test('the owner can edit body/title but not re-tag a note', async () => {
  await seed(CLASS_ID, classNote());
  const ref = doc(verified('alice'), CLASS_ID);
  await assertSucceeds(updateDoc(ref, { body: 'Anchor, then spring', title: '', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { weekOf: '2026-11-23', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { className: 'Other', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { body: 'x'.repeat(10001), updatedAt: serverTimestamp() }));
});
test('the owner can delete; others cannot', async () => {
  await seed(CLASS_ID, classNote());
  await assertFails(deleteDoc(doc(verified('bob'), CLASS_ID)));
  await assertSucceeds(deleteDoc(doc(verified('alice'), CLASS_ID)));
});
