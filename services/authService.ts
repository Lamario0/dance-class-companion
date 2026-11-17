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
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const MAX_NAME = 40;

export interface AccountState {
  user: User | null;
  /** email accounts must click the verification link; Google accounts are verified */
  verified: boolean;
  isAdmin: boolean;
  displayName: string;
  /** displayName came from the stored profile (chat posts must match it exactly) */
  profileLoaded: boolean;
}

/** Names nobody can use (firestore.rules enforces the same list). */
const RESERVED_NAMES = ['studio admin', 'former student'];
export const isReservedName = (n: string) => RESERVED_NAMES.includes(n.trim().toLowerCase());
const reservedNameError = () => Object.assign(new Error('reserved name'), { code: 'app/reserved-name' });

const profileRef = (uid: string) => doc(db, 'users', uid);

/** The signed-in user is still `uid` (guards writes and state updates against sign-out/delete races). */
const stillSignedIn = (uid: string) => auth.currentUser?.uid === uid;

// One profile write at a time per account: the watcher and sign-up can both reach
// ensureProfile at once, and two "create" writes would collide (the second is an
// update the rules reject).
const profileLocks = new Map<string, Promise<void>>();

/**
 * Create users/{uid} the first time we see an account (any sign-in path), or set
 * its name when `name` is given (email sign-up). Safe to call concurrently.
 */
const ensureProfile = (user: User, name?: string): Promise<void> => {
  const run = async () => {
    if (!stillSignedIn(user.uid)) return; // signed out / deleted meanwhile: don't resurrect the profile
    const ref = profileRef(user.uid);
    const picked = (name || user.displayName || user.email?.split('@')[0] || 'Dancer').trim().slice(0, MAX_NAME);
    const displayName = isReservedName(picked) ? 'Dancer' : picked; // e.g. a Google account named "Studio Admin"
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      try {
        await setDoc(ref, { displayName, createdAt: serverTimestamp() });
        return;
      } catch (err: any) {
        // Created elsewhere (another tab) between our read and write: fall through to the name check.
        if (err?.code !== 'permission-denied') throw err;
      }
    }
    if (name) {
      const current = (await getDoc(ref)).data()?.displayName;
      if (current !== displayName) await updateDoc(ref, { displayName });
    }
  };
  const prev = profileLocks.get(user.uid) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(run);
  profileLocks.set(user.uid, next);
  return next;
};

/** Live account state. Fires on sign-in/out and whenever the ID token refreshes (claims, verification). */
export const watchAccount = (onChange: (s: AccountState) => void) => {
  // Finish a redirect-based Google sign-in (used when popups are blocked).
  getRedirectResult(auth).catch(err => console.error('Google redirect sign-in failed', err));

  // A role granted while someone was away lives in a fresh token only, so refresh once per page load.
  let refreshed = false;
  // Callbacks are async and can finish out of order; only the newest one may report.
  let seq = 0;
  return onIdTokenChanged(auth, async user => {
    const mine = ++seq;
    const current = () => mine === seq && (user ? stillSignedIn(user.uid) : !auth.currentUser);
    if (!user) {
      onChange({ user: null, verified: false, isAdmin: false, displayName: '', profileLoaded: false });
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
    let profileLoaded = false;
    try {
      // Any sign-in path (popup, redirect, native app) gets a profile on first sight.
      if (current()) await ensureProfile(user);
      const snap = await getDoc(profileRef(user.uid));
      if (snap.exists()) {
        displayName = snap.data().displayName || displayName;
        profileLoaded = true;
      }
    } catch (err) {
      console.error('Profile load failed', err);
    }
    if (!current()) return; // a newer sign-in state has already been reported
    onChange({ user, verified: user.emailVerified, isAdmin: token.claims['admin'] === true, displayName, profileLoaded });
  });
};

export const signUpWithEmail = async (name: string, email: string, password: string) => {
  if (isReservedName(name)) throw reservedNameError();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const displayName = name.trim().slice(0, MAX_NAME);
  // Verification email first, so a later hiccup can never leave the student without one.
  await sendEmailVerification(cred.user);
  await updateProfile(cred.user, { displayName });
  try {
    await ensureProfile(cred.user, displayName);
  } catch (err) {
    console.error('Saving the profile name failed', err); // the account itself is fine; the name can be fixed in the sheet
  }
  await cred.user.getIdToken(true); // re-emit state with the name filled in
};

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    // The account watcher creates the profile, so a profile hiccup can't turn a good sign-in into an error.
    await signInWithPopup(auth, provider);
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
  if (isReservedName(displayName)) throw reservedNameError();
  await updateDoc(profileRef(u.uid), { displayName });
  await updateProfile(u, { displayName });
  // Their chat messages show the account name, so follow the rename (the rules check
  // it matches the profile). Written in batches; if any batch fails the caller is told,
  // since the account itself is already renamed.
  let messagesOk = true;
  try {
    const mine = await getDocs(query(collection(db, 'chatMessages'), where('uid', '==', u.uid)));
    const stale = mine.docs.filter(d => d.data().author !== displayName);
    for (let i = 0; i < stale.length; i += 400) {
      const batch = writeBatch(db);
      stale.slice(i, i + 400).forEach(d => batch.update(d.ref, { author: displayName }));
      await batch.commit();
    }
  } catch (err) {
    console.error('Updating your name on chat messages failed', err);
    messagesOk = false;
  }
  await u.getIdToken(true);
  return { messagesOk };
};

export const signOut = () => fbSignOut(auth);

/** fetch() to our own /api/* functions with the signed-in user's ID token. */
export const authedFetch = async (path: string, init: RequestInit = {}) => {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${await u.getIdToken()}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status });
  return body;
};

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
    case 'app/reserved-name':
      return 'That name is reserved. Please pick another one.';
    case 'auth/requires-recent-login':
      return 'For safety, sign out and back in, then try again.';
    default:
      return (err as Error)?.message && !code ? (err as Error).message : 'Something went wrong. Please try again.';
  }
};
