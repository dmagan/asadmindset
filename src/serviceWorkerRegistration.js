const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  )
);

let waitingRegistration = null;

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

    // When SW activates after user accepted update → reload
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_ACTIVATED') {
        console.log(`[App] SW activated v${event.data.version}, reloading...`);
        window.location.reload();
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      setInterval(() => { registration.update(); }, 60 * 1000);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('🔄 New version available!');
              waitingRegistration = registration;
              window.dispatchEvent(new CustomEvent('swUpdateAvailable'));
              if (config && config.onUpdate) config.onUpdate(registration);
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
          registration.unregister().then(() => { window.location.reload(); });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => { console.log('Offline mode enabled'); });
}

// User clicked update → tell SW to skip waiting
export function applyUpdate() {
  if (waitingRegistration && waitingRegistration.waiting) {
    waitingRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}