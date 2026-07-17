const CACHE_NAME = 'amar-saude-v6';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora requests não-GET e chrome-extension
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }

  const url = new URL(request.url);

  // Ignora hosts externos, API, e arquivos com query string (Vite dev modules)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/collections/')) return;
  if (url.search && url.search.includes('v=')) return;

  // NUNCA cacheia navegações com query string (verificação de e-mail, etc)
  if (request.mode === 'navigate' && url.search) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return res;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/') || new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        }
        return new Response('', { status: 408, statusText: 'Request Timeout' });
      });
    })
  );
});
