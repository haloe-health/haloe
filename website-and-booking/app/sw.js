// haloe app service worker — caches the app SHELL only (page, fonts, logo,
// icons, the Supabase client library). It never touches Supabase or any
// cross-origin data request, so client health data is never written to disk
// by the cache. Bump CACHE when the shell changes.
const CACHE = 'haloe-app-v3';
const SHELL = [
  '/app/',
  '/app/manifest.webmanifest',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png',
  '/calm.css',
  '/fonts/TAN-ASHFORD.woff2',
  '/haloe-logo-flower.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase/CDN: network only
  const path = url.pathname;

  // The page itself: network first, shell copy when offline.
  if (req.mode === 'navigate' && (path === '/app' || path.startsWith('/app/'))) {
    e.respondWith(fetch(req).catch(() => caches.match('/app/')));
    return;
  }
  // Shell assets: cache first, refresh in the background.
  if (SHELL.includes(path)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
