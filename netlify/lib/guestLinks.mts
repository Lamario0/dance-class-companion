// Linking a guest to an account (attendance slice 5): the guest's check-ins move
// to the account (`uid` set, `guestId` kept as `linkedGuestId`) and back again.
// Used by /api/admin/levels and by account deletion.
import { FieldValue, type Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { checkinId } from './studio.mts';

const inBatches = async (db: Firestore, refs: DocumentReference[], data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>) => {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach(r => batch.update(r, data));
    await batch.commit();
  }
};

/**
 * Claims the guest for `uid` first (so two links at once can't both win), then
 * moves its check-ins. A class the account already has that day stays with the guest.
 */
export const linkGuestCheckins = async (db: Firestore, guestId: string, uid: string, name: string) => {
  const guestRef = db.doc(`guests/${guestId}`);
  const claimed = await db.runTransaction(async tx => {
    const g = (await tx.get(guestRef)).data();
    if (!g) return 'missing' as const;
    if (g.linkedUid) return 'linked' as const;
    tx.update(guestRef, { linkedUid: uid, linkedAt: FieldValue.serverTimestamp() });
    return 'ok' as const;
  });
  if (claimed !== 'ok') return { status: claimed, moved: [] as string[], skipped: 0 };
  const docs = (await db.collection('checkins').where('guestId', '==', guestId).get()).docs;
  const own = docs.length ? await db.getAll(...docs.map(d => db.doc(`checkins/${checkinId(d.data().slotId, d.data().date, uid)}`))) : [];
  const move = docs.filter((_, i) => !own[i].exists);
  await inBatches(db, move.map(d => d.ref), {
    uid, name, linkedGuestId: guestId, guestId: FieldValue.delete(), sheet: 'pending', sheetAt: FieldValue.serverTimestamp(),
  });
  return { status: 'ok' as const, moved: move.map(d => d.id), skipped: docs.length - move.length };
};

/** Moves a linked guest's check-ins back to the guest, then clears the link. */
export const unlinkGuestCheckins = async (db: Firestore, guestId: string) => {
  const guestRef = db.doc(`guests/${guestId}`);
  const g = (await guestRef.get()).data();
  if (!g) return { status: 'missing' as const, moved: [] as string[] };
  if (!g.linkedUid) return { status: 'unlinked' as const, moved: [] as string[] };
  const docs = (await db.collection('checkins').where('linkedGuestId', '==', guestId).get()).docs;
  await inBatches(db, docs.map(d => d.ref), {
    guestId, name: g.name, uid: FieldValue.delete(), linkedGuestId: FieldValue.delete(), sheet: 'pending', sheetAt: FieldValue.serverTimestamp(),
  });
  await guestRef.update({ linkedUid: FieldValue.delete(), linkedAt: FieldValue.delete() });
  return { status: 'ok' as const, moved: docs.map(d => d.id) };
};

/** Before an account is deleted: give every guest linked to it its check-ins back. */
export const unlinkGuestsOf = async (db: Firestore, uid: string) => {
  const guests = await db.collection('guests').where('linkedUid', '==', uid).get();
  for (const g of guests.docs) await unlinkGuestCheckins(db, g.id);
};
