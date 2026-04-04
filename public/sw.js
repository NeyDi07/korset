self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Körset', body: event.data?.text?.() || 'Новое уведомление' }
  }

  const title = payload.title || 'Körset'
  const options = {
    body: payload.body || 'У вас новое уведомление.',
    icon: '/logo.png',
    badge: '/favicon.png',
    data: {
      url: payload.url || '/profile',
      type: payload.type || 'system',
      storeSlug: payload.storeSlug || null,
    },
    tag: payload.tag || payload.type || 'korset-notification',
    renotify: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/profile'

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const matching = allClients.find((client) => client.url.includes(self.location.origin))
    if (matching) {
      matching.focus()
      matching.navigate(url)
      return
    }
    await clients.openWindow(url)
  })())
})
