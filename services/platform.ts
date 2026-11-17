// Running inside the Capacitor Android/iOS app vs the website.
// Uses the global Capacitor injects into the WebView, so the website's bundle
// doesn't pull in @capacitor/core just to ask.

const SITE = 'https://danceclasscompanion.com';

export const isNativeApp = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

/**
 * URL for our Netlify functions. On the website it stays relative (same origin);
 * in the app there is no /api on the device, so it goes to the live site
 * (which answers CORS for the app's origin only).
 */
export const apiUrl = (path: string) => (isNativeApp() ? `${SITE}${path}` : path);
