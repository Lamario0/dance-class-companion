import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { DancingDots } from './Doodles';

type ToastState = 'loading' | 'success' | 'error';
interface Toast { id: number; message: string; state: ToastState; leaving?: boolean }

interface ToastApi {
  /** Shows a toast; returns a handle to update it (loading → success). */
  show: (message: string, state?: ToastState) => {
    update: (message: string, state: ToastState) => void;
    dismiss: () => void;
  };
}

const Ctx = createContext<ToastApi | null>(null);

export const useToast = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(t => t.map(x => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 260);
  }, []);

  const show = useCallback<ToastApi['show']>(
    (message, state = 'success') => {
      const id = nextId.current++;
      setToasts(t => [...t.slice(-2), { id, message, state }]);
      let timer = state === 'loading' ? 0 : window.setTimeout(() => dismiss(id), 2600);
      return {
        update: (m, s) => {
          setToasts(t => t.map(x => (x.id === id ? { ...x, message: m, state: s } : x)));
          window.clearTimeout(timer);
          if (s !== 'loading') timer = window.setTimeout(() => dismiss(id), 2200);
        },
        dismiss: () => dismiss(id),
      };
    },
    [dismiss]
  );

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] md:bottom-8"
        aria-live="polite"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-full bg-text-hi pl-3 pr-5 py-2.5 text-[15px] font-semibold text-surface-0 shadow-[var(--shadow-float)] transition-all duration-300 ${
              t.leaving ? 'opacity-0 translate-y-3' : 'animate-rise'
            }`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-0/10">
              {t.state === 'loading' ? (
                <span className="scale-[.6]"><DancingDots label={t.message} dotClass="bg-brand-strong" /></span>
              ) : t.state === 'success' ? (
                <Check key="ok" className="h-4 w-4 text-emerald-700 animate-pop" strokeWidth={3} />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-700" />
              )}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
};
