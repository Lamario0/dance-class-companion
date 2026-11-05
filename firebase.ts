// Firebase app initialization.
// Web config comes from Vite env vars (see .env / Netlify site settings) —
// these are safe to expose client-side; access is enforced by Firestore
// security rules (firestore.rules), not by keeping this config secret.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Local dev: VITE_FIRESTORE_EMULATOR=host:port points the app at the Firestore emulator.
const emulator = import.meta.env.VITE_FIRESTORE_EMULATOR as string | undefined;
if (emulator) {
  const [host, port] = emulator.split(':');
  connectFirestoreEmulator(db, host, Number(port));
}
export const auth = getAuth(app);
