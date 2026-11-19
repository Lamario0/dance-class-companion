// Account removal shared by self-deletion (/api/delete-account) and admin
// deletion (/api/admin/delete-user), so both behave identically.
import { FieldValue } from 'firebase-admin/firestore';
import { unlinkGuestsOf } from './guestLinks.mts';
import { adminAuth, adminDb } from './firebaseAdmin.mts';

/**
 * Removes a login and its data. Every step is safe to repeat, so a failed
 * attempt can simply be retried. Throws on failure (except "already gone").
 */
export const deleteAccountData = async (uid: string) => {
  try {
    await adminAuth().revokeRefreshTokens(uid); // other devices stop refreshing right away
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }
  const db = adminDb();
  // Profile (and notes) first: without a profile the rules refuse new member posts,
  // so nothing can slip in under the account while its messages are relabelled.
  await db.recursiveDelete(db.collection('users').doc(uid));
  // Chat messages stay, but no longer point at the account: shown as "Former student",
  // with no member link, so only admins can change them from here on.
  const msgs = await db.collection('chatMessages').where('uid', '==', uid).get();
  for (let i = 0; i < msgs.docs.length; i += 400) {
    const batch = db.batch();
    msgs.docs.slice(i, i + 400).forEach(d =>
      batch.update(d.ref, { author: 'Former student', uid: FieldValue.delete(), role: FieldValue.delete() }),
    );
    await batch.commit();
  }
  // Check-ins stay so headcounts stay right, relabelled the same way (slice 3B);
  // `sheet: 'pending'` makes the sync job rewrite their Attendance rows.
  // Slice 5: guests linked to this account get their own check-ins back first.
  await unlinkGuestsOf(db, uid);
  const checkins = await db.collection('checkins').where('uid', '==', uid).get();
  for (let i = 0; i < checkins.docs.length; i += 400) {
    const batch = db.batch();
    checkins.docs.slice(i, i + 400).forEach(d =>
      batch.update(d.ref, { name: 'Former student', uid: FieldValue.delete(), sheet: 'pending' }),
    );
    await batch.commit();
  }
  try {
    await adminAuth().deleteUser(uid);
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw err; // already gone (a retry)
  }
};
