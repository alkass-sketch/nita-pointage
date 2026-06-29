const CACHE = 'nita-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-144.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Mise en cache du shell à l'installation
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Suppression des anciens caches à l'activation
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // n8n webhook : réseau uniquement — la queue localStorage gère l'offline
  if (url.hostname.includes('n8n.cloud')) return;

  // Google Sheets : réseau en priorité, cache en fallback
  if (url.hostname.includes('docs.google.com')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Shell : cache en priorité, réseau en fallback
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
  );
});
