// ═══════════════════════════════════════════════════
// VictoryEdge Pro — Service Worker (sw.js)
// Handles background push notifications
// ═══════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBGDP2QlZYQg0wUsIWKHyvzGuluzVTNIDE',
  authDomain: 'victoryedge-pro.firebaseapp.com',
  databaseURL: 'https://victoryedge-pro-default-rtdb.firebaseio.com/',
  projectId: 'victoryedge-pro',
  storageBucket: 'victoryedge-pro.firebasestorage.app',
  messagingSenderId: '362346490085',
  appId: '1:362346490085:web:b1db5eb49feb9eb7068c0c'
});

const messaging = firebase.messaging();

// Handle background messages (when app is closed/minimised)
messaging.onBackgroundMessage(function(payload) {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'VictoryEdge Pro', {
    body: body || '',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      { action: 'open', title: '⚽ View Picks' }
    ]
  });
});

// Click on notification — open the app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
