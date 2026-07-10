// Service Worker for Senegram Push Notifications
const CACHE_NAME = 'senegram-v3-runtime-reset';
const STATIC_ASSETS = [];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(caches.delete(CACHE_NAME));
  self.skipWaiting();
});

// Activate - clean every old app shell/cache so stale JS bundles cannot survive.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
      .then(() => clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: 'APP_CACHE_RESET' });
        });
      })
  );
});

// Fetch - network only. This SW exists for push notifications, not app caching.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request));
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  if (!event.data) {
    console.log('[SW] Push event has no data');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);
    const { title, body, icon, badge, tag, data: pushData } = data;
    
    const options = {
      body,
      icon: icon || '/favicon.svg',
      badge: badge || '/favicon.svg',
      tag: tag || 'senegram-notification',
      data: pushData || {},
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'Ouvrir' },
        { action: 'dismiss', title: 'Fermer' },
      ],
      vibrate: [200, 100, 200],
    };
    
    console.log('[SW] Showing notification:', title, options);
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Push handler error:', err);
  }
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') return;
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url, data: event.notification.data });
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-messages') {
    event.waitUntil(sendOfflineMessages());
  }
});

async function sendOfflineMessages() {
  // Implementation for offline message queue
  console.log('Sync: sending offline messages');
}

// Message from main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
