// Slice 6: can this browser do web push (no Firebase imports, so cheap to load).
import { isNativeApp } from './platform';

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export const webPushSupported = () =>
  !isNativeApp() && !!VAPID_KEY && typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export const webPushPermission = (): NotificationPermission | 'unsupported' =>
  webPushSupported() ? Notification.permission : 'unsupported';
