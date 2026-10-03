/**
 * Notifications on this device, for the reminders.
 *
 * Web Push needs three things, and each one missing is its own message:
 * a browser that has it (on an iPhone that means the app added to the Home
 * Screen — Safari in a tab has no push at all), a server with a VAPID key,
 * and the person's permission. When all three are there, the browser's
 * subscription is handed to the API, which sends the reminders to it.
 */

/**
 * - `unsupported` — this browser has no Web Push
 * - `install` — iPhone / iPad in Safari: push arrives only in the installed app
 * - `server-off` — the server has no VAPID keys; reminders are kept, not sent
 * - `denied` — the person (or the browser) said no; only site settings undo it
 */
export type PushState = 'checking' | 'unsupported' | 'install' | 'server-off' | 'denied' | 'off' | 'on'

interface PushConfig {
  enabled: boolean
  public_key: string | null
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    // iPadOS asks for the desktop site and says it is a Mac
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** The VAPID key arrives as URL-safe base64; `subscribe` wants the bytes */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }
  return bytes
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function usePush() {
  const api = useApi()
  const state = useState<PushState>('push-state', () => 'checking')
  const busy = ref(false)

  function supported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  }

  async function worker(): Promise<ServiceWorkerRegistration | null> {
    return (await navigator.serviceWorker.getRegistration().catch(() => undefined)) ?? null
  }

  async function check() {
    if (!supported()) {
      state.value = isIos() && !isStandalone() ? 'install' : 'unsupported'
      return
    }
    const config = await api.get<PushConfig>('/push/config').catch(() => null)
    if (!config?.enabled) {
      state.value = 'server-off'
      return
    }
    if (Notification.permission === 'denied') {
      state.value = 'denied'
      return
    }
    const subscription = await (await worker())?.pushManager.getSubscription().catch(() => null)
    state.value = subscription && Notification.permission === 'granted' ? 'on' : 'off'
  }

  /** Asks for permission and subscribes this browser. Must run from a tap —
   *  browsers only show the permission prompt in answer to one. */
  async function enable(): Promise<void> {
    busy.value = true
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        state.value = permission === 'denied' ? 'denied' : 'off'
        return
      }
      const config = await api.get<PushConfig>('/push/config')
      const registration = await worker()
      if (!config.enabled || !config.public_key) {
        state.value = 'server-off'
        return
      }
      if (!registration) {
        // No service worker: a development build, or the app not loaded yet
        throw new Error('Reload the app once, then try again.')
      }
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(config.public_key)
        })
      const json = subscription.toJSON()
      await api.post('/push/subscriptions', { endpoint: json.endpoint, keys: json.keys })
      // Reminders run in the person's own clock
      await api.patch('/eating/settings', { timezone: browserTimezone() })
      state.value = 'on'
    } finally {
      busy.value = false
    }
  }

  async function disable(): Promise<void> {
    busy.value = true
    try {
      const subscription = await (await worker())?.pushManager.getSubscription()
      if (subscription) {
        await api.request('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } })
        await subscription.unsubscribe()
      }
      state.value = 'off'
    } finally {
      busy.value = false
    }
  }

  async function test(): Promise<{ sent: number, failed: number }> {
    return api.post<{ sent: number, failed: number }>('/push/test')
  }

  return { state, busy, check, enable, disable, test }
}
