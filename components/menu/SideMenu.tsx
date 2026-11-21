// Left-hand menu (spec slice 3.5). Signed-in users only. Holds My notes and
// Account now; admins also get an Admin section (filled in by slice 4).
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, NotebookPen, UserRound, ShieldCheck, Users, QrCode, CalendarCheck, ClipboardList, ScanLine, GraduationCap, BellRing } from 'lucide-react';
import { isNativeApp } from '../../services/platform';
import { useToast } from '../ui/Toast';
import { useAccount } from '../auth/AuthProvider';

/** Hamburger button for the header; renders nothing when signed out. */
export const MenuButton: React.FC<{ open: boolean; onClick: () => void; buttonRef: React.RefObject<HTMLButtonElement> }> = ({
  open,
  onClick,
  buttonRef,
}) => {
  const { user } = useAccount();
  if (!user) return null;
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      aria-expanded={open}
      aria-controls="side-menu"
      data-tip="Menu"
      className="tip press -ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-mid hover:bg-surface-1 hover:text-text-hi"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
};

const initials = (name: string, email?: string | null) =>
  (name || email || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
  onNotes: () => void;
  onAccount: () => void;
  /** admins only: the Students & roles page */
  onStudents: () => void;
  /** admins only: Class slots (attendance QR codes) */
  onSlots: () => void;
  onAttendance: () => void;
  /** admins only: who came to each class */
  onClassAttendance: () => void;
  /** admins only: levels and promotions (slice 5) */
  onLevels: () => void;
  onNotifications: () => void;
  /** Android app only (slice 4): a class QR was scanned in the app */
  onScanned: (slotId: string) => void;
  /** the header button, so focus can return to it */
  returnFocusTo: React.RefObject<HTMLButtonElement>;
}

export const SideMenu: React.FC<SideMenuProps> = ({ open, onClose, onNotes, onAccount, onStudents, onSlots, onAttendance, onClassAttendance, onLevels, onNotifications, onScanned, returnFocusTo }) => {
  const toast = useToast();
  // Slice 4: Google's code scanner; a class code goes to its check-in.
  const scan = async () => {
    onClose();
    try {
      const { scanClassCode } = await import('../../services/appLinks');
      const r = await scanClassCode();
      if (r.kind === 'slot') onScanned(r.slotId);
      else if (r.kind === 'other') toast.show("That's not a class code. Scan the QR code posted for your class.", 'error');
    } catch (err) {
      console.error('scan', err);
      toast.show("The scanner didn't open. If this is the first time, give it a minute to finish installing and try again.", 'error');
    }
  };
  const { user, displayName, isAdmin } = useAccount();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const draggedRef = useRef(false);
  const [dx, setDx] = useState(0);

  // Mount, then slide in on the next frame; slide out, then unmount (after the 340ms slide).
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 380);
    return () => window.clearTimeout(t);
  }, [open]);

  // The page behind doesn't scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Focus into the panel when it opens, back to the hamburger when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && shown) panelRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    if (!open && wasOpen.current) returnFocusTo.current?.focus();
    wasOpen.current = open;
  }, [open, shown, returnFocusTo]);

  // Esc closes; Tab stays inside the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a')];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Close if the user signs out while it's open.
  useEffect(() => { if (open && !user) onClose(); }, [open, user, onClose]);

  if (!mounted || !user) return null;

  // Swipe left to close. Only counts as a drag past a small threshold, so taps on items
  // aren't misread; the pointer is captured so a mouse released outside still ends it;
  // a click that ends a drag is swallowed so it doesn't also open an item.
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, dx: 0 };
    draggedRef.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const delta = Math.min(0, e.clientX - drag.current.x);
    if (!draggedRef.current) {
      if (delta > -10) return;
      draggedRef.current = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not supported */ }
    }
    drag.current.dx = delta;
    setDx(delta);
  };
  const onPointerEnd = () => {
    const moved = drag.current?.dx ?? 0;
    drag.current = null;
    setDx(0);
    if (moved < -70) onClose();
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
    }
  };

  const item = (label: string, icon: React.ReactNode, onClick: () => void, sub?: string) => (
    <button
      type="button"
      onClick={onClick}
      className="press flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-[16px] font-semibold text-text-hi hover:bg-surface-2"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-brand-soft">{icon}</span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        {sub && <span className="block text-[13px] font-normal text-text-lo">{sub}</span>}
      </span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        id="side-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
        className={`absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col border-r border-white/10 bg-surface-1 shadow-[var(--shadow-float)] ${
          dx ? '' : 'transition-transform duration-[340ms] ease-[var(--ease-calm)]'
        }`}
        style={{
          transform: shown ? `translateX(${dx}px)` : 'translateX(-105%)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          touchAction: 'pan-y',
        }}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[15px] font-bold text-white">
              {initials(displayName, user.email)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold">{displayName || 'Dancer'}</p>
              <p className="truncate text-[13px] text-text-lo">{user.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-lo hover:bg-surface-2 hover:text-text-hi">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Your stuff" className="mt-5 flex-1 overflow-y-auto px-3">
          {item('My notes', <NotebookPen className="h-[18px] w-[18px]" />, onNotes)}
          {isNativeApp() && item('Scan to check in', <ScanLine className="h-[18px] w-[18px]" />, scan)}
          {item('My attendance', <CalendarCheck className="h-[18px] w-[18px]" />, onAttendance)}
          {item('Account', <UserRound className="h-[18px] w-[18px]" />, onAccount)}

          {isAdmin && (
            <section aria-label="Admin" className="mt-6 border-t border-line pt-4">
              <p className="eyebrow mb-2 flex items-center gap-1.5 px-3"><ShieldCheck className="h-3.5 w-3.5" /> Admin</p>
              {item('Students & roles', <Users className="h-[18px] w-[18px]" />, onStudents, 'Accounts, admins')}
              {item('Class slots', <QrCode className="h-[18px] w-[18px]" />, onSlots, 'Check-in QR codes')}
              {item('Attendance', <ClipboardList className="h-[18px] w-[18px]" />, onClassAttendance, 'Who came, add people')}
              {item('Levels', <GraduationCap className="h-[18px] w-[18px]" />, onLevels, 'Promotions, guests, targets')}
              {item('Notifications', <BellRing className="h-[18px] w-[18px]" />, onNotifications, 'Send to app users')}
            </section>
          )}
        </nav>
      </div>
    </div>,
    document.body,
  );
};
