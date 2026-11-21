// Minimal app-shell service worker: network-first for same-origin GETs,
// falling back to cache when offline. Cross-origin requests (Google Sheets,
// Apps Script, /api/* functions) and non-GET requests pass straight through
// so live class data and AI/admin calls are never served stale.
const CACHE_NAME = 'dcc-cache-v1';
const CORE_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});

// --- Push notifications (slice 6) ---------------------------------------------
// The server sends data-only web pushes ({ data: { kind, tab, title, body, tag } }).
// If a window of the site is focused, it decides (no alert while the chat is
// open; a toast otherwise); if not, we show a system notification. Chat alerts
// share one tag, so a new one replaces the last instead of piling up.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }
  const d = payload.data || payload;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const focused = wins.find((w) => w.focused && w.visibilityState === 'visible');
      if (focused) {
        focused.postMessage({ type: 'push', data: d });
        return undefined;
      }
      return self.registration.showNotification(d.title || 'Dance Class Companion', {
        body: d.body || '',
        tag: d.tag || undefined,
        renotify: !!d.tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: d,
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) {
        win.postMessage({ type: 'open', data: d });
        return win.focus();
      }
      return self.clients.openWindow('/?open=' + encodeURIComponent(d.tab || 'news'));
    })
  );
});
