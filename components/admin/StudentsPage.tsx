// Students & roles (spec slice 4). Admins only; everything is re-checked on the
// server (/api/admin/*), this page just shows what the server returns.
import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, ShieldOff, Trash2, RotateCw, Mail, BadgeCheck, AlertCircle } from 'lucide-react';
import { useAccount } from '../auth/AuthProvider';
import { useToast } from '../ui/Toast';
import { BottomSheet } from '../ui/BottomSheet';
import { DancingDots, EmptyState } from '../ui/Doodles';

interface Row {
  uid: string;
  name: string;
  email: string;
  joined: string | null;
  lastSignIn: string | null;
  method: 'google' | 'email';
  verified: boolean;
  admin: boolean;
  self: boolean;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';

const GoogleDot = () => (
  <svg viewBox="0 0 48 48" className="h-3.5 w-3.5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

type Pending = { kind: 'grant' | 'revoke' | 'delete'; row: Row } | null;

export const StudentsPage: React.FC = () => {
  const { isAdmin, service } = useAccount();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!service || !isAdmin) return;
    let live = true;
    setError('');
    service
      .authedFetch('/api/admin/users')
      .then(body => live && setRows(body.users))
      .catch(err => live && setError(err.status === 403 ? "Your account isn't an admin." : "Couldn't load students. Check your connection and try again."));
    return () => { live = false; };
  }, [service, isAdmin, reload]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(r => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, query]);

  if (!isAdmin) {
    return <div className="card mx-auto max-w-md"><EmptyState doodle="swirl" title="Admins only." body="This page is for studio admins." /></div>;
  }

  const confirm = async () => {
    if (!pending || !service) return;
    setBusy(true);
    const { kind, row } = pending;
    try {
      if (kind === 'delete') {
        await service.authedFetch('/api/admin/delete-user', { method: 'POST', body: JSON.stringify({ uid: row.uid }) });
        setRows(rs => rs?.filter(r => r.uid !== row.uid) ?? null);
        toast.show(`Deleted ${row.name || row.email}'s account`, 'success');
      } else {
        const admin = kind === 'grant';
        await service.authedFetch('/api/admin/role', { method: 'POST', body: JSON.stringify({ uid: row.uid, admin }) });
        setRows(rs => rs?.map(r => (r.uid === row.uid ? { ...r, admin } : r)) ?? null);
        toast.show(admin ? `${row.name || row.email} is now an admin` : `${row.name || row.email} is no longer an admin`, 'success');
      }
      setPending(null);
    } catch (err) {
      toast.show((err as Error).message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const who = pending ? pending.row.name || pending.row.email : '';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin</p>
        <h2 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">Students &amp; roles</h2>
      </div>

      {error ? (
        <div className="card">
          <EmptyState
            doodle="swirl"
            title={error}
            action={<button type="button" onClick={() => { setRows(null); setReload(n => n + 1); }} className="btn-secondary press"><RotateCw className="h-4 w-4" /> Try again</button>}
          />
        </div>
      ) : !rows ? (
        <div className="flex items-center gap-3 py-6 text-text-mid"><DancingDots label="Loading students" /> Loading students…</div>
      ) : (
        <div className="card p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold">{rows.length} {rows.length === 1 ? 'account' : 'accounts'}</p>
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Search by name or email</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-lo" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email" className="input !min-h-11 !py-2 !pl-9" />
            </label>
          </div>

          {shown.length === 0 ? (
            <p className="py-6 text-center text-text-lo">No accounts match “{query}”.</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map(r => (
                <li key={r.uid} className="py-3">
                  {/* Phones: details full width, actions underneath. Wider: side by side. */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-hi">{r.name || 'No name'}</span>
                        {r.self && <span className="text-[13px] text-text-lo">(you)</span>}
                        {r.admin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-strong/25 px-2 py-0.5 text-[12px] font-semibold text-brand-soft ring-1 ring-brand/40">
                            <ShieldCheck className="h-3 w-3" /> Admin
                          </span>
                        )}
                      </p>
                      <p className="break-all text-[14px] text-text-mid">{r.email || 'No email'}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-lo">
                        <span className="inline-flex items-center gap-1">
                          {r.method === 'google' ? <><GoogleDot /> Google</> : <><Mail className="h-3.5 w-3.5" /> Email</>}
                        </span>
                        <span className={`inline-flex items-center gap-1 ${r.verified ? '' : 'text-amber-300'}`}>
                          {r.verified ? <><BadgeCheck className="h-3.5 w-3.5" /> Verified</> : <><AlertCircle className="h-3.5 w-3.5" /> Not verified</>}
                        </span>
                        <span>Joined {fmt(r.joined)}</span>
                        <span>Last in {fmt(r.lastSignIn)}</span>
                      </p>
                    </div>
                    {!r.self && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPending({ kind: r.admin ? 'revoke' : 'grant', row: r })}
                          className="btn-secondary press !min-h-11 !px-3 text-[14px]"
                        >
                          {r.admin ? <><ShieldOff className="h-4 w-4" /> Remove admin</> : <><ShieldCheck className="h-4 w-4" /> Make admin</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPending({ kind: 'delete', row: r })}
                          aria-label={`Delete ${r.name || r.email}'s account`}
                          data-tip="Delete account"
                          data-tip-align="end"
                          className="tip press grid h-11 w-11 place-items-center rounded-full text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <BottomSheet
        open={pending !== null}
        onClose={() => !busy && setPending(null)}
        size="sm"
        title={pending?.kind === 'delete' ? `Delete ${who}'s account?` : pending?.kind === 'grant' ? `Make ${who} an admin?` : `Remove ${who}'s admin role?`}
      >
        <p className="text-text-mid">
          {pending?.kind === 'delete'
            ? "This permanently deletes their login, profile and notes. Their chat messages stay, shown as from a former student. This can't be undone."
            : pending?.kind === 'grant'
              ? 'They’ll be able to moderate the chat and manage students. It takes effect the next time they open the app.'
              : 'They’ll be signed out and lose admin tools when they sign back in (open sessions can keep admin for up to an hour).'}
        </p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => setPending(null)} disabled={busy} className="btn-secondary press flex-1">Cancel</button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`btn-primary press flex-1 ${pending?.kind === 'delete' ? '!bg-rose-600 hover:!bg-rose-500' : ''}`}
          >
            {busy ? <DancingDots label="Working" dotClass="bg-white" /> : pending?.kind === 'delete' ? 'Delete forever' : pending?.kind === 'grant' ? 'Make admin' : 'Remove admin'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
