// Slice 6: push notifications on this device.
// - Android app: @capacitor-firebase/messaging. Permission is asked once, on the
//   first launch after the update; the system shows notifications while the app
//   is in the background.
// - Web: Firebase Cloud Messaging through our own service worker (public/sw.js),
//   which shows them. The browser is asked only when the user taps "Turn on
//   notifications". Needs VITE_FIREBASE_VAPID_KEY; without it web push is off.
// Every token is registered with the server (/api/push/register), tied to the
// signed-in account if there is one; re-registered on sign-in/out.
import { auth } from '../firebase';
import { apiUrl, isNativeApp } from './platform';
import { VAPID_KEY, webPushPermission, webPushSupported } from './pushSupport';

export interface PushData {
  kind?: string;
  tab?: string;
  title?: string;
  body?: string;
  id?: string;
}

type Handlers = {
  /** a notification arrived while the app/page was open */
  onForeground: (d: PushData) => void;
  /** the user tapped a notification */
  onOpen: (d: PushData) => void;
};

const VAPID = VAPID_KEY;
const ASKED_KEY = 'dcc-push-asked';
let currentToken: string | null = null;

const register = async (token: string) => {
  currentToken = token;
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  await fetch(apiUrl('/api/push/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ token, platform: isNativeApp() ? 'android' : 'web' }),
  }).catch(err => console.warn('push register', err));
};

/** Re-tie this device to whoever is signed in now (call on sign-in/out). */
export const reregister = () => (currentToken ? register(currentToken) : Promise.resolve());

// --- Android app ---------------------------------------------------------------

const startNative = async (h: Handlers) => {
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
  await FirebaseMessaging.addListener('tokenReceived', e => void register(e.token));
  await FirebaseMessaging.addListener('notificationReceived', e => h.onForeground({ ...(e.notification.data as PushData), title: e.notification.title, body: e.notification.body }));
  await FirebaseMessaging.addListener('notificationActionPerformed', e => h.onOpen((e.notification.data ?? {}) as PushData));
  const { receive } = await FirebaseMessaging.checkPermissions();
  let asked = false;
  try {
    asked = localStorage.getItem(ASKED_KEY) === '1';
  } catch { /* ignore */ }
  if (receive !== 'granted' && receive !== 'denied' && !asked) {
    try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* ignore */ }
    await FirebaseMessaging.requestPermissions();
  }
  // Registered even without permission: the bell still lists admin notifications.
  const { token } = await FirebaseMessaging.getToken();
  if (token) await register(token);
};

// --- Web -----------------------------------------------------------------------

export { webPushSupported, webPushPermission };

const webToken = async () => {
  const [{ getMessaging, getToken, isSupported }, { app }] = await Promise.all([import('firebase/messaging'), import('../firebase')]);
  if (!(await isSupported())) return null;
  const reg = await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: reg });
};

/** The "Turn on notifications" button: asks the browser, then registers. */
export const enableWebPush = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!webPushSupported()) return 'unsupported';
  const p = await Notification.requestPermission();
  if (p === 'granted') {
    const t = await webToken();
    if (t) await register(t);
  }
  return p;
};

let webHandlers: Handlers | null = null;
const onSwMessage = (e: MessageEvent) => {
  const m = e.data;
  if (m?.type === 'push') webHandlers?.onForeground(m.data ?? {});
  if (m?.type === 'open') webHandlers?.onOpen(m.data ?? {});
};

const startWeb = async (h: Handlers) => {
  webHandlers = h;
  navigator.serviceWorker?.addEventListener('message', onSwMessage);
  // A tapped notification that opened a new tab: /?open=news
  const open = new URLSearchParams(location.search).get('open');
  if (open) {
    h.onOpen({ tab: open, kind: open === 'news' ? 'chat' : undefined });
    history.replaceState(null, '', location.pathname);
  }
  if (webPushPermission() === 'granted') {
    const t = await webToken().catch(err => (console.warn('web push token', err), null));
    if (t) await register(t);
  }
};

let started = false;
/** Start once per page load. Safe to call when push isn't available. */
export const startPush = (h: Handlers) => {
  if (started) return;
  started = true;
  (isNativeApp() ? startNative(h) : startWeb(h)).catch(err => console.warn('push start', err));
};

/** Admin notifications for this device's bell (Android app; the web has none). */
export const fetchMyNotifications = async (): Promise<Array<{ id: string; title: string; body: string; tab: string | null; sentAt: number }>> => {
  if (!isNativeApp()) return [];
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const res = await fetch(apiUrl('/api/notifications'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ platform: 'android' }),
  });
  if (!res.ok) throw new Error(`notifications ${res.status}`);
  return (await res.json()).items;
};
