const CACHE_NAME = 'parka-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Do not intercept non-GET requests, WebSockets, or backend API endpoints
  if (
    event.request.method !== 'GET' || 
    requestUrl.pathname.startsWith('/api/') ||
    event.request.url.includes('socket.io')
  ) {
    return;
  }

  // Network-First strategy for index.html / navigate requests to prevent serving stale index.html
  const isNavigate = event.request.mode === 'navigate' || 
                     requestUrl.pathname === '/' || 
                     requestUrl.pathname === '/index.html';

  if (isNavigate) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline, fall back to cached index.html
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }
  
  // Cache-First strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache static files dynamically (e.g. built assets)
        if (
          networkResponse.status === 200 && 
          requestUrl.origin === self.location.origin &&
          (requestUrl.pathname.startsWith('/assets/') || requestUrl.pathname.endsWith('.js') || requestUrl.pathname.endsWith('.css'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
