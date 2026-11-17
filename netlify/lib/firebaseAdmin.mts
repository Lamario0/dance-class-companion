// Shared Firebase Admin setup for Netlify functions (lives outside
// netlify/functions so Netlify doesn't deploy it as a function of its own).
//
// Production: credentials from the FIREBASE_SERVICE_ACCOUNT env var (JSON).
// Local dev:  when FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST are set
//             (vite dev middleware), the Admin SDK talks to the emulators and
//             needs only a project id.
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const usingEmulators = () => !!(process.env['FIREBASE_AUTH_EMULATOR_HOST'] || process.env['FIRESTORE_EMULATOR_HOST']);

export const adminConfigured = () => usingEmulators() || !!process.env['FIREBASE_SERVICE_ACCOUNT'];

const getApp = (): App => {
  const existing = getApps()[0];
  if (existing) return existing;
  if (usingEmulators()) return initializeApp({ projectId: process.env['GCLOUD_PROJECT'] || 'dance-class-companion' });
  return initializeApp({ credential: cert(JSON.parse(process.env['FIREBASE_SERVICE_ACCOUNT'] as string)) });
};

export const adminAuth = () => getAuth(getApp());
export const adminDb = () => getFirestore(getApp());

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** The signed-in Firebase user behind `Authorization: Bearer <ID token>`, or null. */
export const verifyUser = async (req: Request) => {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
};
