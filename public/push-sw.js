/*
 * Notifications, inside the service worker. The PWA's generated worker
 * imports this file (nuxt.config.ts → pwa.workbox.importScripts), so the
 * app shell caching and the reminders live in one worker.
 *
 * The API sends { title, body, url, tag } — see app/services/reminders.py in
 * nutrijurnal-back. A tap opens the app at `url`, reusing a window that is
 * already open.
 */

self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    message = { body: event.data ? event.data.text() : '' }
  }
  const title = message.title || 'Nutrijurnal'
  event.waitUntil(self.registration.showNotification(title, {
    body: message.body || '',
    tag: message.tag || undefined,
    // A newer reminder of the same kind replaces the old one instead of piling up
    renotify: Boolean(message.tag),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: message.url || '/' }
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  // A reminder only ever opens the app itself
  if (target.origin !== self.location.origin) {
    target = new URL('/', self.location.origin)
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === target.origin && 'focus' in client) {
        await client.focus()
        try {
          // Refused for a window this worker doesn't control yet (opened
          // before it installed); the focused app is still the right place
          await client.navigate(target.href)
        } catch {
          // stay on the focused window as it is
        }
        return
      }
    }
    await self.clients.openWindow(target.href)
  })())
})
