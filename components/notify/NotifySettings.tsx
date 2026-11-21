// Slice 6: notification settings in the account sheet - the "Chat messages"
// switch, turning on browser notifications, and the "Muted people" list.
import React, { useState } from 'react';
import { BellRing, MessageCircle, UserX } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { setChatNotify, unmute, usePrefs } from '../../services/prefsService';
import { webPushPermission } from '../../services/pushSupport';

const NotifySettings: React.FC<{ uid: string }> = ({ uid }) => {
  const prefs = usePrefs(uid);
  const toast = useToast();
  const [perm, setPerm] = useState(webPushPermission);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await setChatNotify(uid, !prefs.chatNotify);
    } catch (e) {
      console.error(e);
      toast.show("Couldn't save. Please try again.", 'error');
    } finally {
      setBusy(false);
    }
  };
  const turnOn = async () => {
    const { enableWebPush } = await import('../../services/pushService');
    const p = await enableWebPush().catch(() => 'default' as const);
    setPerm(p);
    if (p === 'denied') toast.show('Notifications are blocked. You can allow them in your browser settings.', 'error');
  };

  return (
    <section aria-labelledby="notify-h" className="mt-6">
      <h3 id="notify-h" className="eyebrow">Notifications</h3>
      <div className="mt-2 flex min-h-14 items-center gap-3 rounded-[var(--radius-sm)] bg-surface-2 px-4 py-2">
        <MessageCircle className="h-5 w-5 shrink-0 text-brand-soft" />
        <span className="flex-1">
          <span className="block font-semibold text-text-hi" id="chat-switch-label">Chat messages</span>
          <span className="block text-[14px] text-text-lo">A ping when someone posts in the community chat</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.chatNotify}
          aria-labelledby="chat-switch-label"
          disabled={busy}
          onClick={toggle}
          className={`press relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 ${prefs.chatNotify ? 'bg-brand' : 'bg-line'}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] duration-300 ease-[var(--ease-spring)] ${prefs.chatNotify ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
      {perm === 'default' && (
        <button type="button" onClick={turnOn} className="btn-secondary press mt-2 w-full"><BellRing className="h-4 w-4" /> Turn on notifications on this device</button>
      )}
      {perm === 'denied' && <p className="mt-2 text-[14px] text-text-lo">Notifications are blocked for this site in your browser settings.</p>}

      <h4 className="mt-4 text-[15px] font-semibold text-text-mid">Muted people</h4>
      {prefs.muted.length === 0 ? (
        <p className="mt-1 text-[14px] text-text-lo">Nobody. To mute someone, tap the bell-off button on one of their chat messages.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {prefs.muted.map(m => (
            <li key={m.k} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-surface-2 pl-3">
              <UserX className="h-4 w-4 shrink-0 text-text-lo" />
              <span className="min-w-0 flex-1 truncate">{m.n}{m.k.startsWith('g:') && <span className="text-text-lo"> (guest)</span>}</span>
              <button
                type="button"
                onClick={() => unmute(uid, m).then(() => toast.show(`${m.n} is unmuted.`, 'success'), () => toast.show("Couldn't unmute. Please try again.", 'error'))}
                className="press min-h-11 rounded-full px-4 text-[15px] font-semibold text-brand-soft hover:bg-surface-1"
              >
                Unmute
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default NotifySettings;
