// Admin > Class slots (attendance slice 1). A slot is a recurring class time
// ("Tue 7:00pm") with the class currently taught in it ("WCS 201"). Its QR
// encodes a permanent /checkin/<slotId> link, so editing the title never
// changes the printed code. Slots are archived, never deleted.
// Slice 3A: saves go through /api/admin/slot, which also writes the Slots
// worksheet; the class is picked from the Classes worksheet; what the sheet says
// is shown (it wins).
import React, { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Download, Pencil, Plus, Printer, QrCode, RefreshCw, RotateCw, ShieldCheck } from 'lucide-react';
import { useAccount } from '../auth/AuthProvider';
import { useToast } from '../ui/Toast';
import { BottomSheet } from '../ui/BottomSheet';
import { DancingDots, EmptyState } from '../ui/Doodles';
import { checkinLink, createSlot, subscribeSlots, updateSlot, withSheet, MAX_SLOT_TEXT, type Slot } from '../../services/attendanceService';
import { authedFetch } from '../../services/authService';
import { useSyllabus } from '../../services/useSyllabus';

const SHEET_LATER = 'The Google Sheet will catch up within 15 minutes.';

/** PNG data URL of a slot's QR (library loaded on first use). */
const qrDataUrl = async (text: string) => {
  const QR = await import('qrcode');
  return QR.toDataURL(text, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
};

const fileName = (s: Slot) => `checkin-${s.label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || s.id}.png`;

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const printQr = (s: Slot, png: string) => {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Check in · ${escapeHtml(s.label)}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;margin:40px;color:#111}
h1{font-size:40px;margin:0 0 6px}p{font-size:22px;margin:0 0 24px;color:#444}img{width:min(80vw,520px);image-rendering:pixelated}
small{display:block;margin-top:18px;font-size:14px;color:#666}</style></head>
<body><h1>Scan to check in</h1><p>${escapeHtml(s.label)}</p><img src="${png}" alt="Check-in QR code"><small>${escapeHtml(checkinLink(s.id))}</small>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
};

const SlotCard: React.FC<{ slot: Slot; onEdit: () => void }> = ({ slot, onEdit }) => {
  const toast = useToast();
  const [png, setPng] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [qrAttempt, setQrAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const link = checkinLink(slot.id);

  useEffect(() => {
    if (slot.archived) return;
    let live = true;
    setQrFailed(false);
    qrDataUrl(link).then(
      u => live && setPng(u),
      e => { console.error('qr', e); if (live) setQrFailed(true); },
    );
    return () => { live = false; };
  }, [link, slot.archived, qrAttempt]);

  const setArchived = async (archived: boolean) => {
    setBusy(true);
    try {
      const { synced } = await updateSlot(slot.id, { archived });
      const msg = archived ? 'Slot archived. Its QR no longer checks anyone in.' : 'Slot restored.';
      toast.show(synced ? msg : `${msg} ${SHEET_LATER}`, 'success');
    } catch (e) {
      console.error(e);
      toast.show("Couldn't save. Try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`card p-4 md:p-5 ${slot.archived ? 'opacity-70' : ''}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {!slot.archived && (
          <div className="mx-auto grid h-44 w-44 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-white p-2 sm:mx-0 sm:h-36 sm:w-36">
            {png ? (
              <img src={png} alt={`QR code for ${slot.label}`} className="h-full w-full" />
            ) : qrFailed ? (
              <button type="button" onClick={() => setQrAttempt(n => n + 1)} className="press flex min-h-11 flex-col items-center gap-1 px-2 text-center text-[14px] font-semibold text-black">
                <RotateCw className="h-5 w-5" /> Couldn't draw the QR. Retry
              </button>
            ) : (
              <DancingDots label="Drawing QR" dotClass="bg-black/40" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-text-lo">{slot.label}</p>
          <p className="text-[20px] font-extrabold leading-tight text-text-hi">{slot.title}</p>
          {slot.archived ? (
            <p className="mt-1 text-[14px] text-text-lo">Archived: its QR shows “This code isn't active”.</p>
          ) : (
            <p className="mt-1 break-all text-[13px] text-text-lo">{link}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {!slot.archived && (
              <>
                <button type="button" onClick={onEdit} className="btn-secondary press min-h-11"><Pencil className="h-4 w-4" /> Edit</button>
                <a
                  href={png ?? undefined}
                  download={fileName(slot)}
                  aria-disabled={!png}
                  onClick={e => { if (!png) e.preventDefault(); }}
                  className="btn-secondary press min-h-11"
                >
                  <Download className="h-4 w-4" /> PNG
                </a>
                <button
                  type="button"
                  disabled={!png}
                  onClick={() => { if (png && !printQr(slot, png)) toast.show('Allow pop-ups to print the QR.', 'error'); }}
                  className="btn-secondary press min-h-11"
                >
                  <Printer className="h-4 w-4" /> Print
                </button>
              </>
            )}
            <button type="button" disabled={busy} onClick={() => setArchived(!slot.archived)} className="btn-secondary press min-h-11">
              {slot.archived ? <><ArchiveRestore className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

export const SlotsPage: React.FC = () => {
  const { isAdmin } = useAccount();
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // null = closed; 'new' = create; Slot = edit
  const [editing, setEditing] = useState<Slot | 'new' | null>(null);
  const [label, setLabel] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sheetVersion, setSheetVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const syllabus = useSyllabus(sheetVersion);
  // Class titles from the Classes worksheet, grouped by dance.
  const byDance = new Map<string, string[]>();
  for (const c of syllabus?.classes.values() ?? []) byDance.set(c.dance || 'Other', [...(byDance.get(c.dance || 'Other') ?? []), c.title]);

  useEffect(() => {
    if (!isAdmin) return;
    setFailed(false);
    return subscribeSlots(setSlots, err => { console.error('slots', err); setFailed(true); });
  }, [isAdmin, attempt]);

  if (!isAdmin) {
    return <div className="card mx-auto max-w-md"><EmptyState doodle="swirl" title="Admins only." body="This page is for studio admins." /></div>;
  }

  const open = (s: Slot | 'new') => {
    setEditing(s);
    setLabel(s === 'new' ? '' : s.label);
    setTitle(s === 'new' ? '' : s.title);
  };
  const valid = label.trim().length > 0 && title.trim().length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !editing) return;
    setSaving(true);
    try {
      const { synced } = editing === 'new' ? await createSlot(label, title) : await updateSlot(editing.id, { label, title });
      const msg = editing === 'new' ? 'Slot created.' : 'Saved. The QR stays the same.';
      toast.show(synced ? msg : `${msg} ${SHEET_LATER}`, 'success');
      setEditing(null);
    } catch (err) {
      console.error(err);
      toast.show("Couldn't save. Try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r: any = await authedFetch('/api/admin/sheet-sync', { method: 'POST' });
      const added = r.classes?.added ?? 0;
      toast.show(added ? `Added ${added} class${added === 1 ? '' : 'es'} to the Classes worksheet.` : 'The class list is up to date.', 'success');
      setSheetVersion(v => v + 1);
    } catch (err: any) {
      console.error(err);
      toast.show(err?.message || "Couldn't reach the Google Sheet. Try again.", 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const shown = (slots ?? []).map(s => withSheet(s, syllabus));
  const active = shown.filter(s => !s.archived);
  const archived = shown.filter(s => s.archived);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin</p>
          <h2 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">Class slots</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refresh} disabled={refreshing} className="btn-secondary press min-h-11">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} /> Refresh class list
          </button>
          <button type="button" onClick={() => open('new')} className="btn-primary press min-h-11"><Plus className="h-4 w-4" /> New slot</button>
        </div>
      </div>

      {failed ? (
        <div className="card">
          <EmptyState doodle="swirl" title="Couldn't load the slots." body="Check your connection and try again."
            action={<button type="button" onClick={() => { setSlots(null); setAttempt(a => a + 1); }} className="btn-secondary press min-h-11"><RotateCw className="h-4 w-4" /> Try again</button>} />
        </div>
      ) : slots === null ? (
        <div className="flex items-center gap-3 py-6 text-text-mid"><DancingDots label="Loading slots" /> Loading slots…</div>
      ) : active.length === 0 && archived.length === 0 ? (
        <div className="card">
          <EmptyState doodle="sparkle" title="No class slots yet." body="Make one for each weekly class time. Each gets a QR code students scan to check in."
            action={<button type="button" onClick={() => open('new')} className="btn-primary press min-h-11"><QrCode className="h-4 w-4" /> Make the first slot</button>} />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {active.map(s => <SlotCard key={s.id} slot={s} onEdit={() => open(s)} />)}
          </ul>
          {active.length === 0 && <p className="py-4 text-text-lo">No active slots.</p>}
          {archived.length > 0 && (
            <div className="mt-6">
              <button type="button" onClick={() => setShowArchived(v => !v)} aria-expanded={showArchived} className="btn-secondary press min-h-11">
                <Archive className="h-4 w-4" /> {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
              </button>
              {showArchived && (
                <ul className="mt-4 flex flex-col gap-4">
                  {archived.map(s => <SlotCard key={s.id} slot={s} onEdit={() => open(s)} />)}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <BottomSheet
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        eyebrow="Class slot"
        title={editing === 'new' ? 'New slot' : 'Edit slot'}
        size="sm"
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Day and time</span>
            <input value={label} onChange={e => setLabel(e.target.value)} maxLength={MAX_SLOT_TEXT} placeholder="Tue 7:00pm" className="input" autoFocus />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Class being taught</span>
            {byDance.size > 0 ? (
              <select value={title} onChange={e => setTitle(e.target.value)} className="input">
                <option value="" disabled>Pick a class</option>
                {title && !syllabus?.classes.has(title) && <option value={title}>{title} (not in the Classes worksheet)</option>}
                {[...byDance].map(([dance, titles]) => (
                  <optgroup key={dance} label={dance}>
                    {titles.map(t => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                ))}
              </select>
            ) : (
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={MAX_SLOT_TEXT} placeholder="WCS 201" className="input" />
            )}
            <span className="text-[14px] text-text-lo">Change this whenever the class changes, here or in the Slots worksheet. The QR code stays the same.</span>
          </label>
          <button type="submit" disabled={!valid || saving} className="btn-primary press min-h-11">
            {saving ? <DancingDots label="Saving" dotClass="bg-white" /> : editing === 'new' ? 'Create slot' : 'Save'}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
};
