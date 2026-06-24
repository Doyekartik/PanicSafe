const CACHE_NAME = 'panicsafe-pwa-v23';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/firebase-auth.js',
  '/manifest.webmanifest',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/maskable-icon-512.png',
  '/assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = {
      title: 'PanicSafe Alert',
      body: event.data ? event.data.text() : 'A connected PanicSafe user needs attention.'
    };
  }

  const title = payload.title || 'PanicSafe Alert';
  const options = {
    body: payload.body || 'A connected PanicSafe user needs attention.',
    icon: payload.icon || '/assets/icon-192.png',
    badge: payload.badge || '/assets/icon-192.png',
    tag: payload.tag || `panicsafe-connected-alert-${Date.now()}`,
    requireInteraction: payload.requireInteraction !== undefined ? payload.requireInteraction : true,
    renotify: payload.renotify !== undefined ? payload.renotify : true,
    vibrate: payload.vibrate || [200, 100, 200],
    data: payload.data || { url: '/' }
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'PANICSAFE_CONNECTED_ALERT',
            alert: {
              ...payload,
              ...(payload.data || {})
            }
          });
        });
      })
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
