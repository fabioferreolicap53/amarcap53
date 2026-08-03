const CACHE_NAME = 'amar-saude-v7';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
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

  // NAVEGAÇÕES (HTML): network-first — sempre buscar do servidor
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return res;
      }).catch(() => {
        return caches.match('/') || caches.match(request) || new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      })
    );
    return;
  }

  // ASSETS (JS, CSS, imagens): stale-while-revalidate — serve cache imediatamente, atualiza em background
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);

      const fetchPromise = fetch(request).then(res => {
        if (res.ok) {
          cache.put(request, res.clone());
        }
        return res;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
