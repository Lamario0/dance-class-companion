import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Mail, LogOut, Pencil, Check, X, ShieldCheck, Trash2, RotateCw, UserRound } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Segmented } from '../ui/Segmented';
import { DancingDots, SparkleDoodle, NoteDoodle, EmptyState } from '../ui/Doodles';
import { useToast } from '../ui/Toast';
import { useAccount } from './AuthProvider';

const MIN_PASSWORD = 8;

// The notebook pulls in Firestore, so it loads when a signed-in student opens the sheet.
const Notebook = lazy(() => import('../notes/NotesUI').then(m => ({ default: m.Notebook })));

const initials = (name: string, email?: string | null) =>
  (name || email || '?')
    .split(/\s+/)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Header button: initials when signed in, a person icon otherwise. */
export const AccountButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { user, displayName, loading, verified } = useAccount();
  const label = user ? `Your account (${displayName || user.email})` : 'Sign in';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-tip={user ? 'Your account' : 'Sign in'}
      data-tip-align="end"
      className="tip press relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-mid hover:bg-surface-1 hover:text-text-hi"
    >
      {user ? (
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[13px] font-bold text-white">
          {initials(displayName, user.email)}
        </span>
      ) : (
        <UserRound className={`h-6 w-6 ${loading ? 'opacity-50' : ''}`} />
      )}
      {user && !verified && (
        <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-surface-0" aria-hidden="true" />
      )}
    </button>
  );
};

type Mode = 'signin' | 'signup' | 'reset';

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const Field: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, id, ...props }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-text-mid">{label}</label>
    <input id={id} {...props} className="input" />
  </div>
);

/* ------------------------------------------------------------------ */
/* Signed out: Google + email sign in / sign up / reset               */
/* ------------------------------------------------------------------ */
const SignedOut: React.FC = () => {
  const { service } = useAccount();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<false | 'google' | 'email'>(false);
  const [error, setError] = useState('');

  useEffect(() => setError(''), [mode]);

  if (!service) return <Loading />;

  const google = async () => {
    setBusy('google');
    setError('');
    try {
      await service.signInWithGoogle();
    } catch (err) {
      setError(service.friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && password.length < MIN_PASSWORD) {
      setError(`Pick a longer password: at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy('email');
    try {
      if (mode === 'signup') await service.signUpWithEmail(name, email, password);
      else if (mode === 'signin') await service.signInWithEmail(email, password);
      else {
        await service.sendReset(email);
        toast.show('Reset link sent. Check your email.', 'success');
        setMode('signin');
      }
    } catch (err) {
      setError(service.friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-text-mid">
        {mode === 'reset'
          ? "Enter your email and we'll send you a link to pick a new password."
          : 'Keep your own class notes and manage your chat posts. Browsing stays open to everyone.'}
      </p>

      {mode !== 'reset' && (
        <>
          <button
            type="button"
            onClick={google}
            disabled={!!busy}
            className="press mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] bg-white px-4 font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            {busy === 'google' ? <DancingDots label="Opening Google" dotClass="bg-slate-700" /> : <GoogleMark />}
            Continue with Google
          </button>
          <div className="my-5 flex items-center gap-3 text-[13px] text-text-lo" aria-hidden="true">
            <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
          </div>
          <Segmented
            idPrefix="acct"
            label="Email sign-in"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create account' },
            ]}
            className="mb-4"
          />
        </>
      )}

      <form onSubmit={submit} className="space-y-3" noValidate>
        {mode === 'signup' && (
          <Field
            id="acct-name"
            label="Your name"
            autoComplete="name"
            maxLength={40}
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="How classmates will see you"
          />
        )}
        <Field
          id="acct-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        {mode !== 'reset' && (
          <Field
            id="acct-password"
            label="Password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD} characters` : undefined}
          />
        )}

        {error && (
          <p role="alert" className="rounded-[var(--radius-sm)] bg-rose-500/10 px-3 py-2 text-[15px] text-rose-200 animate-fade">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!!busy || !email.trim() || (mode !== 'reset' && !password) || (mode === 'signup' && !name.trim())}
          className="btn-primary press w-full"
        >
          {busy === 'email' ? (
            <DancingDots label="Working" dotClass="bg-white" />
          ) : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </button>

        <div className="flex justify-center">
          {mode === 'signin' && (
            <button type="button" onClick={() => setMode('reset')} className="min-h-11 px-3 text-[15px] font-semibold text-brand-soft hover:underline">
              Forgot password?
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" onClick={() => setMode('signin')} className="min-h-11 px-3 text-[15px] font-semibold text-brand-soft hover:underline">
              Back to sign in
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Email not verified yet                                             */
/* ------------------------------------------------------------------ */
const VerifyEmail: React.FC = () => {
  const { user, service } = useAccount();
  const toast = useToast();
  const [busy, setBusy] = useState<false | 'check' | 'resend'>(false);
  const [note, setNote] = useState('');
  if (!service || !user) return <Loading />;

  const check = async () => {
    setBusy('check');
    setNote('');
    try {
      const ok = await service.refreshVerification();
      if (!ok) setNote("Not verified yet. Open the link in the email, then tap this again.");
    } catch (err) {
      setNote(service.friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    setBusy('resend');
    try {
      await service.resendVerification();
      toast.show('Sent! Check your inbox (and spam).', 'success');
    } catch (err) {
      setNote(service.friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-center">
      <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-brand-strong/20 text-brand-soft">
        <Mail className="h-8 w-8" />
        <SparkleDoodle className="absolute -right-3 -top-2 h-5 w-5 text-accent" />
      </div>
      <h3 className="text-xl font-bold">Check your email</h3>
      <p className="mt-2 text-text-mid">
        We sent a link to <span className="font-semibold text-text-hi break-all">{user.email}</span>. Tap it to finish setting up your account.
      </p>
      {note && <p role="status" className="mt-3 text-[15px] text-amber-200">{note}</p>}
      <div className="mt-5 space-y-2">
        <button type="button" onClick={check} disabled={!!busy} className="btn-primary press w-full">
          {busy === 'check' ? <DancingDots label="Checking" dotClass="bg-white" /> : <><Check className="h-4 w-4" /> I've verified</>}
        </button>
        <button type="button" onClick={resend} disabled={!!busy} className="btn-secondary press w-full">
          {busy === 'resend' ? <DancingDots label="Sending" /> : <><RotateCw className="h-4 w-4" /> Resend email</>}
        </button>
        <button type="button" onClick={() => service.signOut()} className="min-h-11 w-full text-[15px] font-semibold text-text-lo hover:text-text-hi">
          Use a different account
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Signed in                                                          */
/* ------------------------------------------------------------------ */
const SignedIn: React.FC<{
  onDone: () => void;
  registerGuard: (dirty: boolean) => void;
  /** runs the action, first asking "Discard your changes?" if a note has unsaved edits */
  guard: (action: () => void) => void;
}> = ({ onDone, registerGuard, guard }) => {
  const { user, displayName, isAdmin, service } = useAccount();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<false | 'name' | 'delete'>(false);
  const [error, setError] = useState('');
  useEffect(() => setName(displayName), [displayName]);
  if (!service || !user) return <Loading />;

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('name');
    setError('');
    try {
      await service.renameAccount(name);
      setEditing(false);
      toast.show('Name updated', 'success');
    } catch (err) {
      setError(service.friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy('delete');
    setError('');
    const t = toast.show('Deleting your account…', 'loading');
    try {
      await service.deleteAccount();
      t.update('Your account is deleted', 'success');
      onDone();
    } catch (err) {
      t.update("Couldn't delete your account", 'error');
      setError(service.friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  if (confirmDelete) {
    return (
      <div>
        <p className="text-text-mid">
          This permanently deletes your account and your notes. Your chat messages stay, shown as from a former student. This can't be undone.
        </p>
        {error && <p role="alert" className="mt-3 rounded-[var(--radius-sm)] bg-rose-500/10 px-3 py-2 text-[15px] text-rose-200">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy === 'delete'} className="btn-secondary press flex-1">
            Keep my account
          </button>
          <button type="button" onClick={doDelete} disabled={busy === 'delete'} className="btn-primary press flex-1 !bg-rose-600 hover:!bg-rose-500">
            {busy === 'delete' ? <DancingDots label="Deleting" dotClass="bg-white" /> : 'Delete forever'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-lg font-bold text-white">
          {initials(displayName, user.email)}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveName} className="flex items-center gap-1">
              <label htmlFor="acct-rename" className="sr-only">Your name</label>
              <input
                id="acct-rename"
                autoFocus
                maxLength={40}
                value={name}
                onChange={e => setName(e.target.value)}
                className="input !min-h-11 !py-2"
              />
              <button type="submit" disabled={busy === 'name' || !name.trim()} aria-label="Save name" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full text-emerald-300 hover:bg-surface-2">
                {busy === 'name' ? <DancingDots label="Saving" /> : <Check className="h-5 w-5" />}
              </button>
              <button type="button" onClick={() => { setEditing(false); setName(displayName); }} aria-label="Cancel" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-lo hover:bg-surface-2">
                <X className="h-5 w-5" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1">
              <p className="truncate text-xl font-bold">{displayName || 'Dancer'}</p>
              <button type="button" onClick={() => setEditing(true)} aria-label="Change your name" data-tip="Change name" className="tip press grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-lo hover:bg-surface-2 hover:text-text-hi">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="truncate text-[15px] text-text-lo">{user.email}</p>
        </div>
      </div>

      {isAdmin && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-strong/25 px-3 py-1.5 text-[14px] font-semibold text-brand-soft ring-1 ring-brand/40">
          <ShieldCheck className="h-4 w-4" /> Admin
        </p>
      )}

      {error && <p role="alert" className="mt-3 rounded-[var(--radius-sm)] bg-rose-500/10 px-3 py-2 text-[15px] text-rose-200">{error}</p>}

      <div className="mt-6 border-t border-line pt-5">
        <Suspense fallback={<div className="flex justify-center py-6"><DancingDots label="Loading your notes" /></div>}>
          <Notebook registerGuard={registerGuard} />
        </Suspense>
      </div>

      <div className="mt-6 space-y-2">
        <button type="button" onClick={() => guard(() => { service.signOut(); onDone(); })} className="btn-secondary press w-full">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <button type="button" onClick={() => guard(() => setConfirmDelete(true))} className="press inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] text-[15px] font-semibold text-rose-300 hover:bg-rose-500/10">
          <Trash2 className="h-4 w-4" /> Delete my account
        </button>
      </div>
    </div>
  );
};

const Loading = () => (
  <div className="flex justify-center py-10">
    <DancingDots label="Loading your account" />
  </div>
);

/* ------------------------------------------------------------------ */
/* The sheet                                                          */
/* ------------------------------------------------------------------ */
export const AccountSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { user, verified, loading, service, failed, retry } = useAccount();

  // Opening the sheet (or coming back to the tab) re-checks whether the email link was clicked.
  useEffect(() => {
    if (!open || !user || verified || !service) return;
    service.refreshVerification().catch(() => {});
    const onFocus = () => service.refreshVerification().catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open, user, verified, service]);

  // The notebook reports unsaved edits here, so closing the sheet can ask first.
  const notesDirty = useRef(false);
  const registerGuard = useCallback((dirty: boolean) => { notesDirty.current = dirty; }, []);
  // Closing, signing out and deleting all pass through this, so unsaved note edits aren't lost silently.
  const [pending, setPending] = useState<null | (() => void)>(null);
  const askClose = pending !== null;
  useEffect(() => { if (!open) setPending(null); }, [open]);
  const guard = useCallback((action: () => void) => {
    if (notesDirty.current) setPending(() => action);
    else action();
  }, []);
  const requestClose = () => guard(onClose);
  const discardAndClose = () => {
    const action = pending;
    notesDirty.current = false;
    setPending(null);
    action?.();
  };

  const title = loading ? 'Your account' : failed ? 'Sign in' : !user ? 'Sign in' : !verified ? 'Almost there' : 'Your account';
  return (
    <BottomSheet open={open} onClose={requestClose} title={title} size="sm">
      {askClose && (
        <div role="alertdialog" aria-label="Discard your changes?" className="mb-5 rounded-[var(--radius-md)] bg-amber-500/10 p-4 animate-fade">
          <p className="font-bold">Discard your changes?</p>
          <p className="mt-1 text-[15px] text-text-mid">Your edits to this note haven't been saved.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPending(null)} className="btn-primary press flex-1">Keep editing</button>
            <button type="button" onClick={discardAndClose} className="btn-secondary press flex-1">Discard</button>
          </div>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : failed ? (
        <EmptyState
          compact
          doodle="swirl"
          title="Couldn't load sign-in."
          body="Check your connection and try again. Everything else keeps working."
          action={<button type="button" onClick={retry} className="btn-primary press"><RotateCw className="h-4 w-4" /> Try again</button>}
        />
      ) : !user ? (
        <SignedOut />
      ) : !verified ? (
        <VerifyEmail />
      ) : (
        <SignedIn onDone={onClose} registerGuard={registerGuard} guard={guard} />
      )}
    </BottomSheet>
  );
};
