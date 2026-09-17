/* Basim Store — Service Worker v1.0 */
const CACHE_NAME = 'basim-store-v2';
const RUNTIME_CACHE = 'basim-runtime-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(request, copy));
          }
          return res;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Never cache API — categories/products/settings must stay live
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
