self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'HD Studio';
    const options = {
      body: data.body || '',
      icon: '/logo-login.png',
      badge: '/logo-login.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Service Worker Push Hatası:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Açık pencereleri tara, eğer varsa odaklan ve yönlendir
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          const currentOrigin = new URL(self.location.origin);
          if (clientUrl.origin === currentOrigin.origin && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch (e) {
          console.error('Window matching error:', e);
        }
      }
      // Açık pencere yoksa yeni aç
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
