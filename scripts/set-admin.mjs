#!/usr/bin/env node
// Grant or remove the admin role (a Firebase custom claim) for an account.
//
//   Local emulator:  node scripts/set-admin.mjs you@example.com --emulator
//   Live project:    $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\service-account.json'
//                    node scripts/set-admin.mjs you@example.com
//   Remove:          add --remove
//
// The person must have signed in at least once. They see the change after
// their sign-in refreshes (sign out and back in, or within an hour).
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const remove = args.includes('--remove');
const emulator = args.includes('--emulator');

if (!email) {
  console.error('Usage: node scripts/set-admin.mjs <email> [--remove] [--emulator]');
  process.exit(1);
}

const projectId = 'dance-class-companion';
if (emulator) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  initializeApp({ projectId });
} else {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the service-account JSON path (or pass --emulator).');
    process.exit(1);
  }
  initializeApp({ credential: applicationDefault(), projectId });
}

const auth = getAuth();
try {
  const user = await auth.getUserByEmail(email);
  const claims = { ...(user.customClaims || {}) };
  if (remove) delete claims.admin;
  else claims.admin = true;
  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`${remove ? 'Removed admin from' : 'Made admin:'} ${email} (${emulator ? 'emulator' : projectId})`);
} catch (err) {
  console.error(err.code === 'auth/user-not-found' ? `No account for ${email} yet. Sign in once first.` : err.message);
  process.exit(1);
}
