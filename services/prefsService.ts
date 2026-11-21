// Slice 6: the signed-in account's notification preferences, on its profile
// (users/{uid}): chatNotify (default on) and muted (see ./mutes).
import { useEffect, useState } from 'react';
import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MAX_MUTES, readMutes, type Mute } from './mutes';

export interface Prefs { chatNotify: boolean; muted: Mute[] }
const DEFAULT: Prefs = { chatNotify: true, muted: [] };

export const usePrefs = (uid: string | null | undefined): Prefs => {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  useEffect(() => {
    setPrefs(DEFAULT);
    if (!uid) return;
    return onSnapshot(
      doc(db, 'users', uid),
      s => setPrefs({ chatNotify: s.data()?.chatNotify !== false, muted: readMutes(s.data()?.muted) }),
      e => console.warn('prefs', e),
    );
  }, [uid]);
  return prefs;
};

export const setChatNotify = (uid: string, on: boolean) => updateDoc(doc(db, 'users', uid), { chatNotify: on });

export const mute = async (uid: string, m: Mute, current: Mute[]) => {
  if (current.some(x => x.k === m.k)) return;
  if (current.length >= MAX_MUTES) throw new Error(`You can mute up to ${MAX_MUTES} people.`);
  await updateDoc(doc(db, 'users', uid), { muted: arrayUnion({ k: m.k, n: m.n.slice(0, 60) }) });
};
export const unmute = (uid: string, m: Mute) => updateDoc(doc(db, 'users', uid), { muted: arrayRemove(m) });
