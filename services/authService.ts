// Student accounts (Firebase Auth + a profile at users/{uid}).
// Loaded lazily by AuthProvider, so the Firebase SDK isn't in the main bundle.
import {
  onIdTokenChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const MAX_NAME = 40;

export interface AccountState {
  user: User | null;
  /** email accounts must click the verification link; Google accounts are verified */
  verified: boolean;
  isAdmin: boolean;
  displayName: string;
}

const profileRef = (uid: string) => doc(db, 'users', uid);

/** Create users/{uid} the first time we see an account (email sign-up or first Google sign-in). */
const ensureProfile = async (user: User, name?: string) => {
  const ref = profileRef(user.uid);
  const snap = await getDoc(ref);
  const displayName = (name || user.displayName || user.email?.split('@')[0] || 'Dancer').trim().slice(0, MAX_NAME);
  if (!snap.exists()) {
    await setDoc(ref, { displayName, createdAt: serverTimestamp() });
  } else if (name && snap.data().displayName !== displayName) {
    // Sign-up raced the watcher, which created the profile before the name was set.
    await updateDoc(ref, { displayName });
  }
};

/** Live account state. Fires on sign-in/out and whenever the ID token refreshes (claims, verification). */
export const watchAccount = (onChange: (s: AccountState) => void) => {
  // Finish a redirect-based Google sign-in (used when popups are blocked).
  getRedirectResult(auth).catch(err => console.error('Google redirect sign-in failed', err));

  // A role granted while someone was away lives in a fresh token only, so refresh once per page load.
  let refreshed = false;
  return onIdTokenChanged(auth, async user => {
    if (!user) {
      onChange({ user: null, verified: false, isAdmin: false, displayName: '' });
      return;
    }
    if (!refreshed) {
      refreshed = true;
      try {
        await user.reload(); // also picks up an email verified in another tab/device
        await user.getIdToken(true); // fires this callback again with fresh claims
        return;
      } catch {
        /* offline: fall through with the cached token */
      }
    }
    const token = await user.getIdTokenResult();
    let displayName = user.displayName || '';
    try {
      // Any sign-in path (popup, redirect, native app) gets a profile on first sight.
      await ensureProfile(user);
      const snap = await getDoc(profileRef(user.uid));
      if (snap.exists()) displayName = snap.data().displayName || displayName;
    } catch (err) {
      console.error('Profile load failed', err);
    }
    onChange({ user, verified: user.emailVerified, isAdmin: token.claims['admin'] === true, displayName });
  });
};

export const signUpWithEmail = async (name: string, email: string, password: string) => {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const displayName = name.trim().slice(0, MAX_NAME);
  // Set the name on the Auth account first: the watcher's ensureProfile copies it.
  await updateProfile(cred.user, { displayName });
  await ensureProfile(cred.user, displayName);
  await sendEmailVerification(cred.user);
  await cred.user.getIdToken(true); // re-emit state with the name filled in
};

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    await ensureProfile(cred.user);
    await cred.user.getIdToken(true);
  } catch (err: any) {
    // Some phone browsers and in-app browsers block popups: fall back to a full-page redirect.
    // (Reliable only once authDomain is our own domain via the /__/auth proxy in netlify.toml.)
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
};

export const sendReset = (email: string) => sendPasswordResetEmail(auth, email.trim());

export const resendVerification = async () => {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
};

/** Re-check verification after the student clicked the link (in this or another tab/device). */
export const refreshVerification = async () => {
  const u = auth.currentUser;
  if (!u) return false;
  await u.reload();
  await u.getIdToken(true); // emits onIdTokenChanged with the fresh emailVerified
  return auth.currentUser?.emailVerified ?? false;
};

export const renameAccount = async (name: string) => {
  const u = auth.currentUser;
  if (!u) return;
  const displayName = name.trim().slice(0, MAX_NAME);
  await updateDoc(profileRef(u.uid), { displayName });
  await updateProfile(u, { displayName });
  await u.getIdToken(true);
};

export const signOut = () => fbSignOut(auth);

export const deleteAccount = async () => {
  const u = auth.currentUser;
  if (!u) return;
  const res = await fetch('/api/delete-account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await u.getIdToken()}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Couldn't delete your account (${res.status}).`);
  }
  await fbSignOut(auth).catch(() => {});
};

/** Firebase error codes -> plain language for the sheet. */
export const friendlyAuthError = (err: unknown): string => {
  const code = (err as any)?.code as string | undefined;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return "That email and password don't match. Try again or reset your password.";
    case 'auth/email-already-in-use':
      return 'There\'s already an account with that email. Try signing in instead.';
    case 'auth/invalid-email':
      return "That email address doesn't look right.";
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Pick a longer password: at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many tries. Take a breath and try again in a few minutes.';
    case 'auth/network-request-failed':
      return "Couldn't reach the server. Check your connection and try again.";
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was closed before it finished.';
    case 'auth/unauthorized-domain':
      return "Google sign-in isn't set up for this web address yet.";
    case 'auth/operation-not-allowed':
      return "That sign-in method isn't turned on yet.";
    case 'auth/requires-recent-login':
      return 'For safety, sign out and back in, then try again.';
    default:
      return (err as Error)?.message && !code ? (err as Error).message : 'Something went wrong. Please try again.';
  }
};
