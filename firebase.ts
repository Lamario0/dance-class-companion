// Firebase app initialization.
// Web config comes from Vite env vars (see .env / Netlify site settings) —
// these are safe to expose client-side; access is enforced by Firestore
// security rules (firestore.rules), not by keeping this config secret.
//
// Only lazily-loaded modules (services/chatService, services/authService)
// import this file, so the Firebase SDK stays out of the main bundle.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
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
