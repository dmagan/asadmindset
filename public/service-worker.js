const CACHE_NAME = 'asadmindset-shell-v1';
const SHELL_FILES = [
  '/',
  '/index.html'
];

// Install: cache the app shell (index.html with splash loader)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve index.html from cache first (for navigation), network-first for other assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navigation requests (HTML pages) → Cache first, then network
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        // Return cached immediately, but also fetch fresh version in background
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // JS/CSS assets → Network first, fallback to cache
  if (request.url.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }
});
