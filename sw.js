const CACHE = 'fb-cargo-v6';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// NETWORK-FIRST for the app shell (index.html / navigations) — always fetch the freshest
// version from the server first, and only fall back to the cached copy if offline.
// This is what fixes "I updated index.html but the app still shows the old version":
// previously index.html was cache-first, so old cached copies never got replaced unless
// the CACHE version above was manually bumped. Now it self-updates every time there's
// a network connection, with no manual step needed.
function isAppShellRequest(request) {
  if (request.mode === 'navigate') return true;
  const url = new URL(request.url);
  return url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  if (isAppShellRequest(e.request)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // CACHE-FIRST for static assets (icons, manifest) — these rarely change, so it's fine
  // to serve them from cache instantly and only fetch when not already cached.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          return caches.open(CACHE).then((cache) => {
            cache.put(e.request, res.clone());
            return res;
          });
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
