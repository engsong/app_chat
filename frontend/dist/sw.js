// Service Worker for IChat (Offline-First PWA + Push Notifications)
const CACHE_NAME = 'ichat-static-v2';
const API_CACHE_NAME = 'ichat-api-v2';

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/default-avatar.png',
];

// 1. Install Event: Cache Core App Shell & all dynamic JS/CSS build assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching core app shell for offline use');
      await cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] Non-fatal precache error:', err);
      });

      // Fetch /index.html to find and cache every script and stylesheet
      try {
        const res = await fetch('/index.html', { cache: 'no-cache' });
        if (res.ok) {
          const html = await res.text();
          const matches = html.match(/(?:src|href)="(\/assets\/[^"]+)"/g) || [];
          for (const m of matches) {
            const cleanUrl = m.replace(/^(?:src|href)="/, '').replace(/"$/, '');
            try {
              const aRes = await fetch(cleanUrl);
              if (aRes.ok) {
                await cache.put(cleanUrl, aRes);
                console.log('[SW] Precached asset:', cleanUrl);
              }
            } catch (_) {}
          }
        }
      } catch (e) {
        console.warn('[SW] Asset discovery in index.html skipped:', e);
      }
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Claim clients and purge old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Offline-first with smart fallbacks
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle HTTP/HTTPS GET requests
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Skip WebSockets or upload endpoints
  if (url.pathname.includes('/socket.io/') || url.pathname.startsWith('/api/upload')) {
    return;
  }

  // A. Navigation Requests (Opening the App or refreshing without internet)
  if (req.mode === 'navigate') {
    event.respondWith(
      // Try network first with 1.8s timeout
      Promise.race([
        fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, clone);
              cache.put('/index.html', networkRes.clone());
            });
          }
          return networkRes;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 1800))
      ]).catch(async () => {
        // Network failed or offline: serve cached index.html so the app opens immediately
        const cached = (await caches.match(req)) || (await caches.match('/index.html')) || (await caches.match('/'));
        if (cached) {
          return cached;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // B. Static Assets (Scripts, Styles, Icons, Images, Fonts)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        // Return from cache immediately if present (0ms offline launch)
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkRes;
          })
          .catch(() => null);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // C. API Data Requests (/api/*)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          // If online and successful, update API cache with fresh response
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          // If offline: fallback to previously cached data for this API call
          const cached = await caches.match(req);
          if (cached) {
            return cached;
          }
          return new Response(JSON.stringify({ offline: true, error: 'No internet connection' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // D. Default: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
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
