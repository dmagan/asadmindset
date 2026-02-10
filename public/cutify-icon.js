// Firebase Messaging Service Worker
// This file MUST be at the root of your domain (e.g., /firebase-messaging-sw.js)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBR5v8c1t68dw3HrgPkIu1l_twQ5Qjjw7w",
  authDomain: "asadmindset-4d01b.firebaseapp.com",
  projectId: "asadmindset-4d01b",
  storageBucket: "asadmindset-4d01b.firebasestorage.app",
  messagingSenderId: "947229401014",
  appId: "1:947229401014:web:dab4c7d4b8ec60a292eb17"
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message:', payload);

  // Check if any app window is focused - if so, don't show notification
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    const isAppFocused = clientList.some((client) => client.visibilityState === 'visible');
    if (isAppFocused) {
      console.log('[firebase-messaging-sw.js] App is focused, skipping notification');
      return;
    }

    const notificationTitle = payload.notification?.title || 'AsadMindset';
    const notificationOptions = {
      body: payload.notification?.body || 'پیام جدید دارید',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.data?.type + '-' + (payload.data?.conversationId || 'default'),
      data: {
        url: payload.data?.url || '/',
        ...payload.data
      },
      renotify: true,
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(urlToOpen);
    })
  );
});
