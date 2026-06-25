const CACHE_NAME = 'nita-pointage-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ── INSTALL ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH (cache-first, réseau pour les API) ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Toujours réseau pour les appels API (ex: Google Sheets, backend)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Hors ligne. Pointage mis en file d\'attente.' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first pour les assets statiques
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

// ── SYNC EN ARRIÈRE-PLAN (pointages hors ligne) ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pointages') {
    event.waitUntil(syncPointagesEnAttente());
  }
});

async function syncPointagesEnAttente() {
  // Récupérer les pointages stockés localement et les envoyer au backend
  const cache = await caches.open('nita-offline-queue');
  const keys = await cache.keys();
  for (const key of keys) {
    const response = await cache.match(key);
    const pointage = await response.json();
    try {
      await fetch('/api/pointages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pointage)
      });
      await cache.delete(key);
    } catch (e) {
      // Réessayer au prochain sync
    }
  }
}

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Notification NITA Pointage',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'pointer', title: 'Pointer maintenant' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'NITA Pointage', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'pointer') {
    event.waitUntil(clients.openWindow('/?action=entree'));
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});
