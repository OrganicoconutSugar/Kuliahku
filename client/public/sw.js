self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/notifikasi'
  try {
    const url = new URL(value, self.location.origin)
    return url.origin === self.location.origin
      ? url.pathname + url.search + url.hash
      : '/notifikasi'
  } catch {
    return '/notifikasi'
  }
}
self.addEventListener('push', (event) =>
  event.waitUntil(
    (async () => {
      if (!event.data) return
      const data = event.data.json()
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const focused = windows.find((c) => c.visibilityState === 'visible' && c.focused)
      if (focused) {
        focused.postMessage({ type: 'push', ...data, url: safePath(data.url) })
        return
      }
      await self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        icon: '/icons/192.png',
        badge: '/icons/192.png',
        data: { url: safePath(data.url) },
      })
    })(),
  ),
)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const url = new URL(safePath(event.notification.data?.url), self.location.origin).href
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows[0]) {
        const target = await windows[0].navigate(url)
        if (target) await target.focus()
      } else await self.clients.openWindow(url)
    })(),
  )
})
self.addEventListener('pushsubscriptionchange', (event) =>
  event.waitUntil(
    (async () => {
      const key = event.oldSubscription?.options.applicationServerKey
      if (!event.newSubscription && !key) return
      const sub =
        event.newSubscription ||
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }))
      const opts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(sub),
      }
      const result = await fetch('/api/push/subscribe', opts)
      if (result.ok && event.oldSubscription?.endpoint !== sub.endpoint && event.oldSubscription)
        await fetch('/api/push/subscribe', {
          ...opts,
          method: 'DELETE',
          body: JSON.stringify({ endpoint: event.oldSubscription.endpoint }),
        })
    })(),
  ),
)
