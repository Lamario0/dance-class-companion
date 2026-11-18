// Local test accounts for the Auth/Firestore EMULATORS only (never the live project).
// Run with the emulators up: node scripts/seed-emulator.mjs
//   admin-qa@test.dev   verified, admin
//   stu-qa@test.dev     verified student
//   unv-qa@test.dev     unverified student
// Password for all three: emulator-only-pass
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'dance-class-companion' });
const auth = getAuth(app);
const db = getFirestore(app);
const PASSWORD = 'emulator-only-pass';

const accounts = [
  { email: 'admin-qa@test.dev', name: 'QA Admin', verified: true, admin: true },
  { email: 'stu-qa@test.dev', name: 'QA Student', verified: true },
  { email: 'unv-qa@test.dev', name: 'QA Unverified', verified: false },
];

for (const a of accounts) {
  let u;
  try {
    u = await auth.getUserByEmail(a.email);
  } catch {
    u = await auth.createUser({ email: a.email, password: PASSWORD, emailVerified: a.verified, displayName: a.name });
  }
  await auth.updateUser(u.uid, { password: PASSWORD, emailVerified: a.verified });
  await auth.setCustomUserClaims(u.uid, a.admin ? { admin: true } : null);
  await db.doc(`users/${u.uid}`).set({ displayName: a.name, createdAt: new Date() }, { merge: true });
  console.log(`${a.email} -> ${u.uid}`);
}
