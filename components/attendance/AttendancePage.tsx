// My attendance (attendance slice 1; level progress from slice 5): total classes, count per class title,
// and a dated list of check-ins, newest first. Signed-in student's own only.
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, RotateCw } from 'lucide-react';
import { useAccount } from '../auth/AuthProvider';
import { DancingDots, EmptyState } from '../ui/Doodles';
import { ProgressCards } from './ProgressCards';
import { subscribeMyCheckins, dayLabel, type Checkin } from '../../services/attendanceService';

export const AttendancePage: React.FC = () => {
  const { user } = useAccount();
  const [rows, setRows] = useState<Checkin[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    setRows(null);
    setFailed(false);
    return subscribeMyCheckins(user.uid, setRows, err => { console.error('attendance', err); setFailed(true); });
  }, [user, attempt]);

  const perClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.title, (m.get(r.title) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="eyebrow flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" /> Attendance</p>
        <h2 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">My attendance</h2>
      </div>

      {failed ? (
        <div className="card">
          <EmptyState doodle="swirl" title="Couldn't load your attendance." body="Check your connection and try again."
            action={<button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-secondary press min-h-11"><RotateCw className="h-4 w-4" /> Try again</button>} />
        </div>
      ) : rows === null ? (
        <div className="flex items-center gap-3 py-6 text-text-mid"><DancingDots label="Loading attendance" /> Loading attendance…</div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState doodle="feet" title="No classes yet." body="Scan the QR code at the studio when you arrive and your classes show up here." />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {user && <ProgressCards uid={user.uid} rows={rows} />}
          <section className="card p-5" aria-label="Totals">
            <p className="text-[44px] font-extrabold leading-none tracking-tight text-brand-soft">{rows.length}</p>
            <p className="mt-1 text-text-mid">{rows.length === 1 ? 'class attended' : 'classes attended'}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {perClass.map(([title, n]) => (
                <li key={title} className="flex items-center justify-between gap-3 text-[16px]">
                  <span className="min-w-0 truncate font-semibold text-text-hi">{title}</span>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[14px] font-semibold text-text-mid">{n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5" aria-label="History">
            <h3 className="mb-2 font-bold">History</h3>
            <ul className="divide-y divide-line">
              {rows.map(r => (
                <li key={r.id} className="flex flex-col py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <span className="font-semibold text-text-hi">{r.title}</span>
                  <span className="text-[14px] text-text-lo">{dayLabel(r.date)} · {r.slotLabel}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
};
