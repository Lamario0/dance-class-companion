// Slice 6: the header bell. Lists new chat messages since this device last
// looked at the chat and (Android app) the admin notifications meant for this
// user/device; a dot shows when there's something new. On the web it also
// offers "Turn on notifications".
import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, MessageCircle, Megaphone } from 'lucide-react';
import { collection, getCountFromServer, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { BottomSheet } from '../ui/BottomSheet';
import { useToast } from '../ui/Toast';
import { chatSeenAt, onChatSeen } from '../../services/chatPresence';
import { enableWebPush, fetchMyNotifications, webPushPermission } from '../../services/pushService';
import { isNativeApp } from '../../services/platform';

interface Item { id: string; title: string; body: string; tab: string | null; sentAt: number }

const BELL_SEEN = 'dcc-bell-seen';
const readNum = (k: string) => {
  try {
    return Number(localStorage.getItem(k)) || 0;
  } catch {
    return 0;
  }
};
const WEEK = 7 * 24 * 3600 * 1000;

interface Props {
  /** bumps when a notification arrives while the app is open */
  pulse: number;
  onOpenChat: () => void;
  onOpenTab: (tab: string) => void;
}

const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const NotificationBell: React.FC<Props> = ({ pulse, onOpenChat, onOpenTab }) => {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [bellSeen, setBellSeen] = useState(() => readNum(BELL_SEEN));
  const [perm, setPerm] = useState(webPushPermission);

  const refresh = useCallback(async () => {
    const since = Math.max(chatSeenAt(), Date.now() - WEEK);
    try {
      const c = await getCountFromServer(query(collection(db, 'chatMessages'), where('createdAt', '>', Timestamp.fromMillis(since))));
      setChatCount(c.data().count);
    } catch (e) {
      console.warn('chat count', e);
    }
    if (isNativeApp()) fetchMyNotifications().then(setItems, e => console.warn('notifications', e));
  }, []);

  useEffect(() => { void refresh(); }, [refresh, pulse]);
  useEffect(() => onChatSeen(() => setChatCount(0)), []);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  const fresh = items.some(i => i.sentAt > bellSeen);
  const dot = chatCount > 0 || fresh;

  const openSheet = () => {
    setOpen(true);
    void refresh();
    const now = Date.now();
    // Keep "New" marks while the sheet is open; they (and the dot) clear on close.
    try { localStorage.setItem(BELL_SEEN, String(now)); } catch { /* ignore */ }
  };
  const closeSheet = () => {
    setOpen(false);
    setBellSeen(readNum(BELL_SEEN));
  };

  const turnOn = async () => {
    const p = await enableWebPush().catch(() => 'default' as const);
    setPerm(p);
    if (p === 'granted') toast.show("Notifications are on. You'll hear about new chat messages.", 'success');
    else if (p === 'denied') toast.show('Notifications are blocked. You can allow them in your browser settings.', 'error');
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={dot ? 'Notifications (new)' : 'Notifications'}
        data-tip="Notifications"
        className="tip press relative grid h-11 w-11 place-items-center rounded-full text-text-mid hover:bg-surface-2 hover:text-text-hi"
      >
        {dot ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {dot && <span aria-hidden className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface-0 animate-pop" />}
      </button>
      <BottomSheet open={open} onClose={closeSheet} title="Notifications" size="sm">
        <div className="flex flex-col gap-3">
          {perm === 'default' && (
            <div className="rounded-[var(--radius-sm)] border border-line bg-surface-2 p-4">
              <p className="font-semibold text-text-hi">Get a ping for new chat messages</p>
              <p className="mt-1 text-[15px] text-text-mid">Your browser will ask first. You can turn chat messages off any time in your account.</p>
              <button type="button" onClick={turnOn} className="btn-primary press mt-3 min-h-11"><BellRing className="h-4 w-4" /> Turn on notifications</button>
            </div>
          )}
          {perm === 'denied' && (
            <p className="text-[15px] text-text-lo">Notifications are blocked for this site. Allow them in your browser's site settings to get chat alerts.</p>
          )}
          <button
            type="button"
            onClick={() => { closeSheet(); onOpenChat(); }}
            className="press flex min-h-14 items-center gap-3 rounded-[var(--radius-sm)] bg-surface-2 px-4 py-3 text-left hover:bg-line/40"
          >
            <MessageCircle className="h-5 w-5 shrink-0 text-brand-soft" />
            <span className="flex-1">
              <span className="block font-semibold text-text-hi">{chatCount > 0 ? `${chatCount} new message${chatCount === 1 ? '' : 's'} in chat` : 'No new chat messages'}</span>
              <span className="block text-[14px] text-text-lo">Open the community chat</span>
            </span>
            {chatCount > 0 && <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />}
          </button>
          {isNativeApp() && (
            items.length === 0 ? (
              <p className="px-1 py-2 text-[15px] text-text-lo">No studio notifications yet.</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Studio notifications">
                {items.map(i => (
                  <li key={i.id}>
                    <button
                      type="button"
                      disabled={!i.tab}
                      onClick={() => { if (i.tab) { closeSheet(); onOpenTab(i.tab); } }}
                      className="press flex w-full items-start gap-3 rounded-[var(--radius-sm)] bg-surface-2 px-4 py-3 text-left disabled:cursor-default"
                    >
                      <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-text-hi">{i.title}</span>
                          {i.sentAt > bellSeen && <span className="rounded-full bg-accent/20 px-2 text-[12px] font-bold text-accent">New</span>}
                        </span>
                        <span className="mt-0.5 block whitespace-pre-line text-[15px] text-text-mid">{i.body}</span>
                        <span className="mt-1 block text-[13px] text-text-lo">{when(i.sentAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </BottomSheet>
    </>
  );
};

export default NotificationBell;
