#!/usr/bin/env node
// Print an email-verification link for an account, to send the person yourself
// (for when Firebase's verification email doesn't reach them).
//
//   Live project:  $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\service-account.json'
//                  node scripts/verify-link.mjs someone@example.com
//   Local:         node scripts/verify-link.mjs someone@example.com --emulator
//
// The link works once and expires after a while (about 3 days). When they open
// it, the account is verified; in the app they tap "I've verified" or reload.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const emulator = args.includes('--emulator');

if (!email) {
  console.error('Usage: node scripts/verify-link.mjs <email> [--emulator]');
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

try {
  const link = await getAuth().generateEmailVerificationLink(email, { url: 'https://danceclasscompanion.com/' });
  console.log(`Verification link for ${email}:\n\n${link}\n`);
} catch (err) {
  console.error(err.code === 'auth/user-not-found' ? `No account for ${email}.` : err.message);
  process.exit(1);
}
