const CACHE = 'fb-cargo-v7';
const FILES_TO_CACHE = [
  './', './index.html', './manifest.json',
  './icon-72.png','./icon-96.png','./icon-128.png','./icon-144.png',
  './icon-152.png','./icon-192.png','./icon-384.png','./icon-512.png'
];
// Firebase libraries — offline par bhi chahiye (pehle cache nahi hoti thin, aur fail hone par index.html wapas aata tha)
const FIREBASE_LIBS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all([
        cache.addAll(FILES_TO_CACHE),
        ...FIREBASE_LIBS.map((u) => cache.add(u).catch(() => {}))
      ])
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isAppShellRequest(request) {
  if (request.mode === 'navigate') return true;
  const url = new URL(request.url);
  return url.origin === location.origin && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/'));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Firebase libs: cache-first
  if (FIREBASE_LIBS.includes(url.href)) {
    e.respondWith(
      caches.match(e.request).then((c) => c || fetch(e.request).then((res) => {
        const copy = res.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, copy)); return res;
      }))
    );
    return;
  }
  // Baqi sab cross-origin (Firestore, Google Auth ...) ko touch nahi karna
  if (url.origin !== location.origin) return;

  // App shell: NETWORK-FIRST (HTTP cache bypass, taake GitHub ka 10-min cache purana na de)
  if (isAppShellRequest(e.request)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets: cache-first (galat fallback index.html nahi)
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((cache) => cache.put(e.request, copy)); return res;
    }))
  );
});
