// Importé par le service worker de l'app : notifications de fin de repos.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* message illisible : texte par défaut */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Repos terminé', {
    body: data.body || '',
    tag: 'rest',
    renotify: true,
    vibrate: [300, 100, 300],
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    // La fin du repos mène à la Séance (l'accueil est sur « / »).
    for (const client of list) {
      if ('focus' in client) return client.focus().then((c) => (c || client).navigate?.('/seance'))
    }
    return self.clients.openWindow('/seance')
  }))
})
