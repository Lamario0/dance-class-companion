import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Tiny global store so the app shell / tab bar know a sheet is open. */
/* ------------------------------------------------------------------ */
let openCount = 0;
const listeners = new Set<() => void>();
const emit = () => {
  document.documentElement.classList.toggle('sheet-open', openCount > 0);
  listeners.forEach(l => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useAnySheetOpen = () => useSyncExternalStore(subscribe, () => openCount > 0, () => false);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const useIsMobile = () => {
  const query = '(max-width: 767px)';
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
};

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** small label above the title */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** desktop dialog max width */
  size?: 'sm' | 'md';
}

/**
 * Mobile: bottom sheet that springs up, swipe-down / tap-outside / Esc to dismiss,
 * and the app behind it zooms out + dims.
 * Desktop (≥ md): a centered dialog with the same content.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, title, eyebrow, children, footer, size = 'md' }) => {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number; active: boolean } | null>(null);
  const titleId = useId();
  const lastFocus = useRef<HTMLElement | null>(null);

  // mount → animate in; close → animate out → unmount
  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement;
      setMounted(true);
      openCount++;
      emit();
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => {
        cancelAnimationFrame(raf);
        openCount--;
        emit();
      };
    } else if (mounted) {
      setVisible(false);
      const t = window.setTimeout(() => {
        setMounted(false);
        lastFocus.current?.focus?.();
      }, prefersReducedMotion() ? 120 : 380);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc + scroll lock + initial focus
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const auto = panel.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      (auto ?? panel).focus({ preventScroll: true });
    }, 60);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  // ---- swipe-down to dismiss (mobile) ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isMobile) return;
    const panel = panelRef.current;
    // Only start a drag from the handle/header, or from content scrolled to top.
    const fromHandle = (e.target as HTMLElement).closest('[data-sheet-handle]');
    const scroller = panel?.querySelector<HTMLElement>('[data-sheet-scroll]');
    if (!fromHandle && scroller && scroller.scrollTop > 0) return;
    if ((e.target as HTMLElement).closest('input, textarea, button, a, iframe')) return;
    drag.current = { startY: e.clientY, dy: 0, active: true };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d?.active || !panelRef.current) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    panelRef.current.style.transition = 'none';
    panelRef.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    const panel = panelRef.current;
    if (!d || !panel) return;
    panel.style.transition = '';
    panel.style.transform = '';
    if (d.dy > 90) onClose();
  };

  const panelBase = isMobile
    ? `fixed inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[var(--radius-lg)] transition-transform duration-[420ms] ease-[var(--ease-spring)] ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`
    : `relative w-full ${size === 'sm' ? 'max-w-sm' : 'max-w-lg'} max-h-[85vh] rounded-[var(--radius-lg)] transition-[opacity,transform] duration-300 ease-[var(--ease-spring)] ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] ${isMobile ? '' : 'flex items-center justify-center p-6'}`}
      role="presentation"
    >
      {/* scrim — tap outside to dismiss */}
      <div
        className={`absolute inset-0 bg-black/55 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${panelBase} flex flex-col bg-surface-1 border border-line shadow-[var(--shadow-float)] outline-none`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {isMobile && (
          <div data-sheet-handle className="flex justify-center pt-3 pb-1 touch-none cursor-grab">
            <span className="h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
          </div>
        )}
        <div data-sheet-handle className={`flex items-start gap-3 px-6 ${isMobile ? 'pt-2' : 'pt-6'} pb-3 ${isMobile ? 'touch-none' : ''}`}>
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h2 id={titleId} className="text-xl font-bold leading-snug text-text-hi">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-tip="Close"
            data-tip-align="end"
            className="tip press -mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-lo hover:bg-surface-2 hover:text-text-hi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div data-sheet-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
          {children}
        </div>
        {footer && (
          <div className="border-t border-line px-6 pt-4" style={{ paddingBottom: isMobile ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : '1.5rem' }}>
            {footer}
          </div>
        )}
        {!footer && isMobile && <div style={{ height: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }} />}
      </div>
    </div>,
    document.body
  );
};
