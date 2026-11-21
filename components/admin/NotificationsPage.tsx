// Admin only (slice 6): send a notification to Android app users - everyone
// with the app, or one dance + level - and see what was sent (90 days).
import React, { useEffect, useState } from 'react';
import { BellRing, Megaphone, RotateCw, Send, ShieldCheck, Smartphone } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAccount } from '../auth/AuthProvider';
import { useToast } from '../ui/Toast';
import { DancingDots, EmptyState } from '../ui/Doodles';
import { authedFetch } from '../../services/authService';
import { useSyllabus } from '../../services/useSyllabus';
import { useDanceIndex } from '../../services/levelsService';
import { LEVELS, LEVEL_NAMES, type Level } from '../../services/levels';

const MAX_TITLE = 60;
const MAX_BODY = 300;
const TABS = [
  { value: '', label: 'Just open the app' },
  { value: 'classes', label: 'Classes' },
  { value: 'media', label: 'Media' },
  { value: 'news', label: 'News & chat' },
];

interface Sent {
  id: string;
  title: string;
  body: string;
  tab: string | null;
  audience: 'all' | 'group';
  dance?: string;
  level?: Level;
  sentByName: string;
  sentAt: Date | null;
  devices: number;
}

const who = (a: { audience: string; dance?: string; level?: Level }) =>
  a.audience === 'group' && a.dance && a.level ? `${a.dance} - ${LEVEL_NAMES[a.level]}` : 'All app users';

export const NotificationsPage: React.FC = () => {
  const { isAdmin } = useAccount();
  const toast = useToast();
  const syllabus = useSyllabus();
  const { dances } = useDanceIndex(syllabus);
  const [kind, setKind] = useState<'all' | 'group'>('all');
  const [dance, setDance] = useState('');
  const [level, setLevel] = useState<Level>('100');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tab, setTab] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Sent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { if (!dance && dances.length) setDance(dances[0]); }, [dances, dance]);

  const audience = kind === 'all' ? { kind: 'all' } : { kind: 'group', dance, level };
  const audienceKey = JSON.stringify(audience);

  // How many devices will get it (refreshed when the audience changes).
  useEffect(() => {
    if (!isAdmin || (kind === 'group' && !dance)) return;
    let live = true;
    setCount(null);
    authedFetch('/api/admin/notify', { method: 'POST', body: JSON.stringify({ action: 'count', audience }) })
      .then(r => live && setCount(r.devices), e => { console.error(e); if (live) setCount(-1); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, audienceKey]);

  useEffect(() => {
    if (!isAdmin) return;
    setFailed(false);
    return onSnapshot(
      query(collection(db, 'notifications'), orderBy('sentAt', 'desc'), limit(50)),
      s => setSent(s.docs.map(d => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return { id: d.id, title: x.title, body: x.body, tab: x.tab ?? null, audience: x.audience, dance: x.dance, level: x.level, sentByName: x.sentByName ?? 'Admin', sentAt: x.sentAt instanceof Timestamp ? x.sentAt.toDate() : null, devices: x.devices ?? 0 };
      })),
      e => { console.error('notifications', e); setFailed(true); },
    );
  }, [isAdmin, attempt]);

  if (!isAdmin) {
    return <div className="card mx-auto max-w-md"><EmptyState doodle="swirl" title="Admins only." body="This page is for studio admins." /></div>;
  }

  const valid = title.trim().length > 0 && title.trim().length <= MAX_TITLE && body.trim().length > 0 && body.trim().length <= MAX_BODY && (kind === 'all' || !!dance);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || sending) return;
    if (!window.confirm(`Send "${title.trim()}" to ${who({ audience: kind, dance, level })}${count != null && count >= 0 ? ` (${count} device${count === 1 ? '' : 's'})` : ''}?`)) return;
    setSending(true);
    const t = toast.show('Sending…', 'loading');
    try {
      const r = await authedFetch('/api/admin/notify', { method: 'POST', body: JSON.stringify({ action: 'send', audience, title: title.trim(), body: body.trim(), tab: tab || null }) });
      t.update(`Sent to ${r.devices} device${r.devices === 1 ? '' : 's'}.`, 'success');
      setTitle('');
      setBody('');
      setTab('');
    } catch (err: any) {
      console.error(err);
      t.update(err?.message || "Couldn't send. Try again.", 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin</p>
        <h2 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">Notifications</h2>
        <p className="mt-2 text-text-mid">Send a notification to people using the Android app. Chat alerts go out on their own.</p>
      </div>

      <form onSubmit={send} className="card flex flex-col gap-4 p-4 md:p-6">
        <fieldset>
          <legend className="text-[15px] font-semibold text-text-mid">Who gets it</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['all', 'group'] as const).map(k => (
              <label key={k} className={`press flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-3 text-center font-semibold ${kind === k ? 'border-brand bg-brand/15 text-text-hi' : 'border-line text-text-mid'}`}>
                <input type="radio" name="audience" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {k === 'all' ? 'All app users' : 'A dance & level'}
              </label>
            ))}
          </div>
          {kind === 'group' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[14px] text-text-lo">
                Dance
                <select value={dance} onChange={e => setDance(e.target.value)} className="input">
                  {dances.length === 0 && <option value="">Loading…</option>}
                  {dances.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[14px] text-text-lo">
                Level
                <select value={level} onChange={e => setLevel(e.target.value as Level)} className="input">
                  {LEVELS.map(l => <option key={l} value={l}>{LEVEL_NAMES[l]}</option>)}
                </select>
              </label>
              <p className="col-span-2 text-[14px] text-text-lo">Only signed-in app users. Anyone without a level in this dance counts as 100 level.</p>
            </div>
          )}
          <p className="mt-3 flex items-center gap-2 text-[15px] text-text-mid" aria-live="polite">
            <Smartphone className="h-4 w-4 shrink-0" />
            {count === null ? 'Counting devices…' : count < 0 ? "Couldn't count devices." : `${count} device${count === 1 ? '' : 's'} will get it.`}
          </p>
        </fieldset>

        <label className="flex flex-col gap-1 text-[15px] font-semibold text-text-mid">
          Title
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={MAX_TITLE} placeholder="No class Thursday" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-[15px] font-semibold text-text-mid">
          Message
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={MAX_BODY} rows={3} placeholder="The studio is closed for the holiday. See you next week!" className="input resize-none" />
          <span className="self-end text-[13px] font-normal text-text-lo">{body.length}/{MAX_BODY}</span>
        </label>
        <label className="flex flex-col gap-1 text-[15px] font-semibold text-text-mid">
          When tapped, open
          <select value={tab} onChange={e => setTab(e.target.value)} className="input">
            {TABS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!valid || sending || count === 0} className="btn-primary press min-h-12 self-start">
          <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send notification'}
        </button>
      </form>

      <h3 className="mb-3 mt-8 text-xl font-bold">Sent</h3>
      {failed ? (
        <div className="card">
          <EmptyState doodle="swirl" title="Couldn't load what was sent." body="Check your connection and try again."
            action={<button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-secondary press min-h-11"><RotateCw className="h-4 w-4" /> Try again</button>} />
        </div>
      ) : sent === null ? (
        <div className="flex items-center gap-3 py-6 text-text-mid"><DancingDots label="Loading" /> Loading…</div>
      ) : sent.length === 0 ? (
        <div className="card"><EmptyState doodle="sparkle" title="Nothing sent yet." body="Notifications you send show up here for 90 days." /></div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sent.map(n => (
            <li key={n.id} className="card flex gap-3 p-4">
              <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-text-hi">{n.title}</p>
                <p className="mt-0.5 whitespace-pre-line text-text-mid">{n.body}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-text-lo">
                  <span>{who(n)}</span>
                  <span className="inline-flex items-center gap-1"><BellRing className="h-3.5 w-3.5" /> {n.devices} device{n.devices === 1 ? '' : 's'}</span>
                  <span>{n.sentByName}</span>
                  <span>{n.sentAt ? n.sentAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Sending…'}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
