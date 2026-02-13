const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  )
);

// Flag to prevent infinite reload loops
let isReloading = false;

export function register(config) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
      } else {
        registerValidSW(swUrl, config);
      }
    });

    // گوش بده به پیام SW_UPDATED از Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        console.log(`[App] SW updated to version ${event.data.version}, reloading...`);
        if (!isReloading) {
          isReloading = true;
          window.location.reload();
        }
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      // هر 60 ثانیه چک کن آپدیت جدید هست یا نه
      setInterval(() => {
        registration.update();
      }, 60 * 1000);

      // وقتی اپ دوباره visible میشه هم چک کن
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      });

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // نسخه جدید آماده‌ست - SW خودش رفرش می‌کنه via postMessage
              console.log('🔄 New version available, waiting for SW activation...');
            } else {
              console.log('✅ App cached for offline use');
            }
          }
        };
      };
    })
    .catch(error => {
      console.error('SW registration failed:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl)
    .then(response => {
      if (
        response.status === 404 ||
        response.headers.get('content-type').indexOf('javascript') === -1
      ) {
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('Offline mode enabled');
    });
}