// Service Worker for IChat
const CACHE_NAME = 'ichat-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming background push events from Web Push protocol (FCM / Mozilla)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'IChat',
    body: 'New notification on IChat',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'ichat-notification',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (_) {
      payload.body = event.data.text();
    }
  }

  const isCall = payload.tag === 'incoming-call' || (payload.title && payload.title.includes('Call'));

  const options = {
    body: payload.body,
    icon: payload.icon || '/logo.png',
    badge: '/logo.png',
    tag: payload.tag || 'ichat-notification',
    vibrate: isCall
      ? [800, 300, 800, 300, 800, 300, 800, 300, 800]
      : payload.vibrate || [300, 100, 300],
    data: payload.data || { url: '/' },
    requireInteraction: isCall ? true : (payload.requireInteraction || false),
    renotify: true,
    actions: isCall
      ? [
          { action: 'answer', title: '📞 Answer' },
          { action: 'decline', title: '❌ Decline' },
        ]
      : undefined,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Handle notification click: bring user to the active window or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'decline') {
    return;
  }

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
