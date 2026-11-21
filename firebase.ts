// Firebase app initialization.
// Web config comes from Vite env vars (see .env / Netlify site settings) —
// these are safe to expose client-side; access is enforced by Firestore
// security rules (firestore.rules), not by keeping this config secret.
//
// Only lazily-loaded modules (services/chatService, services/authService)
// import this file, so the Firebase SDK stays out of the main bundle.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
// Offline cache: notes written in a studio with bad signal are kept on the
// device and sync when the connection is back. Falls back to memory-only where
// IndexedDB isn't available (some private-browsing modes).
const makeDb = () => {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (err) {
    // Already set up (this module evaluated twice, e.g. hot reload): reuse that instance.
    if (String((err as Error)?.message).includes('already been called')) return getFirestore(app);
    console.warn('Offline cache unavailable, using memory cache', err);
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
};
export const db = makeDb();

// The SDK quietly falls back to memory when IndexedDB is blocked (some private-
// browsing modes), and then offline writes are lost when the tab closes. Probe it
// so the UI doesn't promise "will sync" when it can't.
let persistent = typeof indexedDB !== 'undefined';
if (persistent) {
  try {
    const req = indexedDB.open('dcc-offline-probe');
    req.onerror = () => { persistent = false; };
    req.onsuccess = () => req.result.close();
  } catch {
    persistent = false;
  }
}
export const offlineCacheIsPersistent = () => persistent;
export const auth = getAuth(app);

// Local dev (.env.development.local): point at the emulators instead of production.
const firestoreEmulator = import.meta.env.VITE_FIRESTORE_EMULATOR as string | undefined;
if (firestoreEmulator) {
  const [host, port] = firestoreEmulator.split(':');
  connectFirestoreEmulator(db, host, Number(port));
}
const authEmulator = import.meta.env.VITE_AUTH_EMULATOR as string | undefined;
if (authEmulator) {
  connectAuthEmulator(auth, `http://${authEmulator}`, { disableWarnings: true });
}
