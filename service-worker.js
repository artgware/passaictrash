/* Passaic Debris Tracker — Service Worker
 * Gives the PWA:
 *   1. Offline shell (app loads with no signal)
 *   2. Network-first strategy for the live map tiles + API calls
 *   3. Cache-first strategy for static assets (icons, libraries)
 *   4. Background sync of queued debris reports when connection returns
 */

const CACHE_VERSION = 'passaic-v4';
const CORE_ASSETS = [
  '/',
  '/passaic-debris-tracker.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Cache core, but don't fail install if a third-party is temporarily 404
      return Promise.allSettled(CORE_ASSETS.map(u => cache.add(u).catch(() => null)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache Apps Script posts or NOAA/USGS live data — always go to network
  const isLiveApi =
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('tidesandcurrents.noaa.gov') ||
    url.hostname.includes('waterservices.usgs.gov');

  if (request.method !== 'GET' || isLiveApi) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({
      ok: false,
      offline: true,
      error: 'offline'
    }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Map tiles → cache-first, network fallback (long-lived)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open('passaic-tiles').then((cache) =>
        cache.match(request).then((hit) =>
          hit || fetch(request).then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          }).catch(() => hit)
        )
      )
    );
    return;
  }

  // Default: network-first with cache fallback for static app shell
  event.respondWith(
    fetch(request).then((res) => {
      if (res && res.status === 200 && (url.origin === self.location.origin || CORE_ASSETS.includes(request.url))) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return res;
    }).catch(() => caches.match(request).then(hit => hit || caches.match('/passaic-debris-tracker.html')))
  );
});

/* Background Sync — fired by the browser when a queued sync wakes up
 * The page registers sync('flush-pending') when a POST fails offline. */
self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-pending') {
    event.waitUntil(notifyClientsToFlush());
  }
});

async function notifyClientsToFlush() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'flush-pending' });
  }
}

/* Let the page request a skipWaiting when a new SW is installed */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* Push notifications — receive a payload and show a banner */
self.addEventListener('push', (event) => {
  const data = (() => { try { return event.data.json(); } catch (e) { return { title: 'Passaic Debris Alert', body: 'New high-severity debris report.' }; } })();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Passaic Debris Alert', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'passaic-alert',
      data: data.url || '/'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || '/'));
});
