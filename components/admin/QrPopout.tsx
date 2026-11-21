// A class slot's QR, enlarged over a heavily blurred screen so the phone
// scanning it can't pick up a neighbouring slot's code by mistake.
// Tap anywhere, the close button, Escape or Android back closes it.
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { pushOverlay } from '../ui/BottomSheet';

interface Props {
  png: string;
  label: string;
  title: string;
  onClose: () => void;
}

export const QrPopout: React.FC<Props> = ({ png, label, title, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const entry = pushOverlay(() => onCloseRef.current());
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !entry.isTop()) return;
      e.stopImmediatePropagation();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Blur the app itself too (not only the backdrop filter, which some phones skip),
    // so no other QR on the page stays sharp enough to scan.
    const root = document.getElementById('root');
    const prevFilter = root?.style.filter ?? '';
    if (root) root.style.filter = 'blur(18px)';
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey, true);
      entry.remove();
      document.body.style.overflow = prevOverflow;
      if (root) root.style.filter = prevFilter;
      back?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`QR code for ${label}`}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex animate-fade flex-col items-center justify-center gap-5 bg-black/85 p-4 backdrop-blur-2xl"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="press absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <X className="h-6 w-6" />
      </button>
      <div className="qr-pop rounded-[var(--radius-md,1rem)] bg-white p-3 shadow-2xl">
        <img src={png} alt={`QR code for ${label}`} className="block h-auto w-[min(86vw,70vh,560px)]" />
      </div>
      <div className="max-w-[min(86vw,560px)] text-center text-white">
        <p className="text-[15px] font-semibold uppercase tracking-wide text-white/70">{label}</p>
        <p className="text-[26px] font-extrabold leading-tight">{title}</p>
        <p className="mt-2 text-[15px] text-white/70">Tap anywhere to close</p>
      </div>
    </div>,
    document.body,
  );
};
