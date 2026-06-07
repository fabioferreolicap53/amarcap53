const CACHE_NAME = 'amar-saude-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Obrigatório para ser instalável no Android
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
