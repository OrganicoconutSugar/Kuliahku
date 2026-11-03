import { api } from './api'
export const iosInstall = () =>
  /iP(ad|hone|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const needsHome = () =>
  iosInstall() &&
  !matchMedia('(display-mode: standalone)').matches &&
  !(navigator as Navigator & { standalone?: boolean }).standalone
export function permission() {
  if (needsHome()) return 'Tambahkan ke Layar Utama'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return 'Tidak didukung'
  return { default: 'Belum diminta', denied: 'Ditolak', granted: 'Diizinkan' }[
    Notification.permission
  ]
}
export async function enablePush() {
  if (needsHome())
    throw new Error(
      'Di Safari, ketuk Bagikan, lalu Tambah ke Layar Utama. Buka KuliahKu dari ikonnya.',
    )
  if (permission() === 'Tidak didukung') throw new Error('Browser ini belum mendukung Web Push.')
  const status = await Notification.requestPermission()
  if (status !== 'granted')
    throw new Error('Izin belum diberikan. Kamu bisa mengubahnya dari pengaturan situs di browser.')
  const reg = await navigator.serviceWorker.ready
  const { key } = await api<{ key: string }>('/push/public-key')
  if (!key) throw new Error('Kunci VAPID belum disiapkan di server.')
  const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  )
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }))
  await api('/push/subscribe', 'POST', sub.toJSON())
}
