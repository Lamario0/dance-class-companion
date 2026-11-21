// Slice 6: starts push for this device once the account state is known and
// re-registers on sign-in/out. Lives inside AuthProvider; pushService is
// loaded lazily so Firebase Messaging stays out of the main bundle.
import React, { useEffect, useRef } from 'react';
import { useAccount } from '../auth/AuthProvider';
import { useToast } from '../ui/Toast';
import { isChatVisible } from '../../services/chatPresence';
import type { PushData } from '../../services/pushService';

interface Props {
  /** something arrived while the app was open (the bell refreshes) */
  onPulse: () => void;
  /** a notification was tapped */
  onOpen: (d: PushData) => void;
}

export const PushBridge: React.FC<Props> = ({ onPulse, onOpen }) => {
  const { user, loading } = useAccount();
  const toast = useToast();
  // Open app: no alert for chat while it's on screen; otherwise a toast.
  const onForeground = (d: PushData) => {
    onPulse();
    if (d.kind === 'chat' && isChatVisible()) return;
    if (d.title) toast.show(d.body ? `${d.title}: ${d.body}` : d.title, 'success');
  };
  const handlers = useRef({ onForeground, onOpen });
  handlers.current = { onForeground, onOpen };
  const lastUid = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    const uid = user?.uid ?? null;
    let cancelled = false;
    import('../../services/pushService').then(p => {
      if (cancelled) return;
      if (lastUid.current === undefined) {
        p.startPush({ onForeground: d => handlers.current.onForeground(d), onOpen: d => handlers.current.onOpen(d) });
      } else if (lastUid.current !== uid) {
        void p.reregister();
      }
      lastUid.current = uid;
    }).catch(err => console.warn('push', err));
    return () => { cancelled = true; };
  }, [user?.uid, loading]);

  return null;
};
