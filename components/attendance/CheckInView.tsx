// The screen a class QR opens: /checkin/<slotId> (attendance slice 1).
// Signed out -> sign-in sheet first; unverified -> "Check your email" first;
// then the check-in posts to /api/checkin once and shows the result big enough
// to read at arm's length.
import React, { useEffect, useRef, useState } from 'react';
import { CalendarCheck, LogIn, MailCheck, RotateCw } from 'lucide-react';
import { useAccount } from '../auth/AuthProvider';
import { DancingDots, EmptyState, SparkleDoodle, FootprintsDoodle } from '../ui/Doodles';
import { getSlot, type Slot } from '../../services/attendanceService';

type Result =
  | { kind: 'checked-in' | 'already'; title: string; label: string }
  | { kind: 'inactive' }
  | { kind: 'error'; message: string };

export const CheckInView: React.FC<{
  slotId: string | null;
  onOpenAccount: () => void;
  onCloseAccount: () => void;
  onDone: () => void;
}> = ({ slotId, onOpenAccount, onCloseAccount, onDone }) => {
  const { user, verified, loading, service } = useAccount();
  const [slot, setSlot] = useState<Slot | null | 'loading' | 'error'>('loading');
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const posted = useRef<string | null>(null);
  const promptedFor = useRef<string | null>(null);
  const retriedStaleToken = useRef(false);

  // The slot (public read) so we can say which class before sign-in.
  useEffect(() => {
    if (!slotId) { setSlot(null); return; }
    let live = true;
    setSlot('loading');
    getSlot(slotId).then(s => live && setSlot(s), () => live && setSlot('error'));
    return () => { live = false; };
  }, [slotId, attempt]);

  const active = slot && typeof slot === 'object' && !slot.archived;

  // Ask for sign-in / verification once per state, as soon as we know we need it.
  const need = loading || !active ? null : !user ? 'signin' : !verified ? 'verify' : null;
  useEffect(() => {
    if (!need) return;
    const key = `${need}:${user?.uid ?? ''}`;
    if (promptedFor.current === key) return;
    promptedFor.current = key;
    onOpenAccount();
  }, [need, user, onOpenAccount]);

  // Verified: check in (once per account per visit).
  useEffect(() => {
    if (!active || !user || !verified || !service || !slotId) return;
    const key = `${user.uid}:${attempt}`;
    if (posted.current === key) return;
    posted.current = key;
    setResult(null);
    service
      .authedFetch('/api/checkin', { method: 'POST', body: JSON.stringify({ slotId }) })
      .then((r: any) => {
        setResult({ kind: r.status === 'already' ? 'already' : 'checked-in', title: r.title, label: r.label });
        onCloseAccount();
        // Done: drop /checkin/<id> from the address bar so a reload keeps the home screen, not a re-check.
        if (window.location.pathname.startsWith('/checkin/')) window.history.replaceState(null, '', '/');
      })
      .catch((e: any) => {
        if (e?.code === 'inactive') {
          setResult({ kind: 'inactive' });
          onCloseAccount();
        } else if (e?.code === 'unverified' && !retriedStaleToken.current) {
          // The server saw a token from before verification: refresh it once and retry, or
          // (if the account really isn't verified) let `verified` bring back the "Check your email" step.
          retriedStaleToken.current = true;
          promptedFor.current = null;
          service.refreshVerification().then(ok => { if (ok) setAttempt(a => a + 1); }, () => setAttempt(a => a + 1));
        } else {
          setResult({ kind: 'error', message: e?.message || "Couldn't check you in." });
          onCloseAccount();
        }
      });
  }, [active, user, verified, service, slotId, attempt, onCloseAccount]);

  const retry = () => { setResult(null); setAttempt(a => a + 1); };
  const home = (
    <button type="button" onClick={onDone} className="btn-secondary press min-h-11">Go to my classes</button>
  );

  const wrap = (children: React.ReactNode) => (
    <div className="mx-auto max-w-md">
      <div className="card">{children}</div>
    </div>
  );

  if (slot === 'loading' || (active && loading)) {
    return <div className="flex items-center justify-center gap-3 py-16 text-text-mid"><DancingDots label="Finding your class" /> Finding your class…</div>;
  }
  if (slot === 'error') {
    return wrap(
      <EmptyState doodle="swirl" title="Couldn't reach the studio." body="Check your connection and try again."
        action={<button type="button" onClick={retry} className="btn-primary press min-h-11"><RotateCw className="h-4 w-4" /> Try again</button>} />,
    );
  }
  if (!active || result?.kind === 'inactive') {
    return wrap(
      <EmptyState doodle="feet" title="This code isn't active." body="Ask at the front desk for this week's class code." action={home} />,
    );
  }

  const classLine = (title: string, label: string) => (
    <p className="mt-2 text-[22px] font-extrabold leading-tight text-text-hi md:text-2xl">
      {title} <span className="text-text-mid font-semibold">· {label}</span>
    </p>
  );

  if (result?.kind === 'checked-in' || result?.kind === 'already') {
    const fresh = result.kind === 'checked-in';
    return wrap(
      <div role="status" className="flex flex-col items-center px-4 py-10 text-center">
        <div className="relative mb-5">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-strong/30 ring-2 ring-brand/50 animate-pop">
            <CalendarCheck className="h-10 w-10 text-brand-soft" />
          </div>
          {fresh && (
            <>
              <SparkleDoodle className="absolute -right-6 -top-3 h-6 w-6 text-accent" delay={100} />
              <SparkleDoodle className="absolute -left-6 top-2 h-4 w-4 text-brand" delay={250} />
              <FootprintsDoodle className="absolute -bottom-3 -right-8 h-6 w-6 text-brand-soft/70" />
            </>
          )}
        </div>
        <h2 className="text-[28px] font-extrabold leading-tight tracking-tight">
          {fresh ? "You're checked in!" : "You're already checked in today"}
        </h2>
        {classLine(result.title, result.label)}
        <p className="mt-3 text-text-lo">{fresh ? 'Have a great class.' : 'Nothing more to do. Enjoy class!'}</p>
        <div className="mt-6">{home}</div>
      </div>,
    );
  }

  const s = slot as Slot;
  if (result?.kind === 'error') {
    return wrap(
      <EmptyState doodle="swirl" title="Couldn't check you in." body={result.message}
        action={<button type="button" onClick={retry} className="btn-primary press min-h-11"><RotateCw className="h-4 w-4" /> Try again</button>} />,
    );
  }

  // Waiting on sign-in, verification or the check-in itself.
  return wrap(
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <p className="eyebrow">Check in</p>
      {classLine(s.title, s.label)}
      {!user ? (
        <>
          <p className="mt-4 text-text-mid">Sign in to check in to this class.</p>
          <button type="button" onClick={onOpenAccount} className="btn-primary press mt-6 min-h-11"><LogIn className="h-4 w-4" /> Sign in</button>
        </>
      ) : !verified ? (
        <>
          <p className="mt-4 text-text-mid">Verify your email first, then we'll check you in.</p>
          <button type="button" onClick={onOpenAccount} className="btn-primary press mt-6 min-h-11"><MailCheck className="h-4 w-4" /> Check your email</button>
        </>
      ) : (
        <div className="mt-6 flex items-center gap-3 text-text-mid"><DancingDots label="Checking you in" /> Checking you in…</div>
      )}
    </div>,
  );
};
