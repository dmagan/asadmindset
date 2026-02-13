// ==============================
// 🔄 VERSION - هر بار بیلد جدید این عدد رو عوض کن!
// ==============================
const APP_VERSION = '4';
const CACHE_NAME = `asadmindset-shell-v${APP_VERSION}`;

const SHELL_FILES = [
  '/',
  '/index.html'
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${APP_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_FILES);
    })
  );
  // فوری فعال شو، منتظر بسته شدن تب‌ها نشو
  self.skipWaiting();
});

// Activate: پاک کردن کش‌های قدیمی + اطلاع به کلاینت
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${APP_VERSION}`);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // کنترل تمام تب‌های باز رو بگیر
      return self.clients.claim();
    }).then(() => {
      // به تمام تب‌های باز بگو رفرش کنن
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
        });
      });
    })
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navigation requests (HTML pages) → Network First, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // شبکه جواب داد → کش رو آپدیت کن
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() => {
          // آفلاین → از کش بخون
          return caches.match('/index.html');
        })
    );
    return;
  }

  // JS/CSS assets → Network first, fallback to cache
  if (request.url.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});