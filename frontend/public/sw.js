// Service Worker for IChat
const CACHE_NAME = 'ichat-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click: bring user to the active window or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Find open IChat client window
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (data.chatId) {
            client.postMessage({
              type: 'NAVIGATE_TO_CHAT',
              chatId: data.chatId,
            });
          }
          return client.focus();
        }
      }
      // If no window is currently open, open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle incoming background push events if supported
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const options = {
      body: payload.body || 'New message on IChat',
      icon: payload.icon || '/logo.png',
      badge: '/logo.png',
      vibrate: payload.vibrate || [200, 100, 200],
      tag: payload.tag || 'ichat-notification',
      data: payload.data || {},
      requireInteraction: payload.requireInteraction || false,
    };
    event.waitUntil(self.registration.showNotification(payload.title || 'IChat', options));
  } catch (e) {
    console.error('[SW] Error handling push event:', e);
  }
});
