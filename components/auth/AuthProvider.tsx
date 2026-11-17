import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AccountState } from '../../services/authService';

type AuthService = typeof import('../../services/authService');

interface AuthCtx extends AccountState {
  /** true until Firebase has reported the first sign-in state */
  loading: boolean;
  /** the lazily-loaded service, or null while it's still downloading */
  service: AuthService | null;
  /** the account code couldn't be downloaded (offline, deploy mid-swap) */
  failed: boolean;
  retry: () => void;
}

const initial: AuthCtx = {
  user: null, verified: false, isAdmin: false, displayName: '', profileLoaded: false, loading: true, service: null, failed: false, retry: () => {},
};
const Ctx = createContext<AuthCtx>(initial);
export const useAccount = () => useContext(Ctx);

/**
 * Loads Firebase Auth after the page has painted (keeps it out of the main
 * bundle) and shares the signed-in state with the app.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthCtx>(initial);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    const start = () =>
      import('../../services/authService').then(service => {
        if (cancelled) return;
        setState(s => ({ ...s, service, failed: false }));
        unsub = service.watchAccount(acct => setState(s => ({ ...s, ...acct, loading: false })));
      }).catch(err => {
        console.error('Account features failed to load', err);
        if (!cancelled) setState(s => ({ ...s, loading: false, failed: true }));
      });
    // Let the first paint happen before pulling in the SDK.
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: object) => number);
    const id = ric ? ric(start, { timeout: 1500 }) : window.setTimeout(start, 300);
    return () => {
      cancelled = true;
      if (ric) (window as any).cancelIdleCallback?.(id); else window.clearTimeout(id);
      unsub?.();
    };
  }, [attempt]);

  const retry = () => {
    setState(s => ({ ...s, loading: true, failed: false }));
    setAttempt(a => a + 1);
  };

  return <Ctx.Provider value={{ ...state, retry }}>{children}</Ctx.Provider>;
};
