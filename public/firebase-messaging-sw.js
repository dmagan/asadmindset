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

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  var data = payload.data || {};
  var title = data.title || 'AsadMindset';
  var options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.location.origin) !== -1 && 'focus' in list[i]) return list[i].focus();
      }
      return clients.openWindow(event.notification.data && event.notification.data.url ? event.notification.data.url : '/');
    })
  );
});