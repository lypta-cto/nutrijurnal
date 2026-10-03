import { describe, expect, it, vi } from 'vitest'
import source from '../../public/push-sw.js?raw'

/**
 * public/push-sw.js runs inside the service worker, where `self` is the
 * worker's global. Here it runs against a stand-in for that global, so what
 * a reminder shows and where a tap on it leads can be checked without a
 * browser that registers workers.
 */
const ORIGIN = 'https://nutrijurnal.app'

interface Window {
  url: string
  focus: ReturnType<typeof vi.fn>
  navigate: ReturnType<typeof vi.fn>
}

type Handler = (event: Record<string, unknown>) => void

function worker(windows: Window[] = []) {
  const handlers: Record<string, Handler> = {}
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler
    },
    registration: { showNotification: vi.fn(async () => {}) },
    clients: {
      matchAll: vi.fn(async () => windows),
      openWindow: vi.fn(async () => null)
    }
  }
  // The file is a classic worker script: it only ever reaches for `self`
  new Function('self', source)(self)

  /** Fires an event the way the browser does and waits for its waitUntil */
  async function fire(type: string, fields: Record<string, unknown>) {
    let pending: Promise<unknown> = Promise.resolve()
    handlers[type]?.({
      ...fields,
      waitUntil: (work: Promise<unknown>) => {
        pending = work
      }
    })
    await pending
  }

  async function tap(url: unknown) {
    const close = vi.fn()
    await fire('notificationclick', { notification: { data: url === undefined ? undefined : { url }, close } })
    return close
  }

  return { self, fire, tap }
}

function appWindow(url = `${ORIGIN}/progress`, navigate = vi.fn(async () => null)): Window {
  return { url, focus: vi.fn(async () => null), navigate }
}

describe('a reminder arriving', () => {
  it('shows the API’s title and words, tagged so a newer one replaces it', async () => {
    const { self, fire } = worker()

    await fire('push', { data: { json: () => ({ title: 'Lunch', body: 'What did you have?', url: '/?add=lunch', tag: 'lunch' }) } })

    expect(self.registration.showNotification).toHaveBeenCalledWith('Lunch', expect.objectContaining({
      body: 'What did you have?',
      tag: 'lunch',
      renotify: true,
      data: { url: '/?add=lunch' }
    }))
  })

  it('still says something when the message is not JSON', async () => {
    const { self, fire } = worker()

    await fire('push', { data: { json: () => JSON.parse('time to eat'), text: () => 'time to eat' } })

    expect(self.registration.showNotification).toHaveBeenCalledWith('Nutrijurnal', expect.objectContaining({
      body: 'time to eat',
      renotify: false,
      data: { url: '/' }
    }))
  })
})

describe('tapping a reminder', () => {
  it('brings the open app forward on the page the reminder names', async () => {
    const open = appWindow()
    const { self, tap } = worker([open])

    const close = await tap('/?add=dinner')

    expect(close).toHaveBeenCalled()
    expect(open.focus).toHaveBeenCalled()
    expect(open.navigate).toHaveBeenCalledWith(`${ORIGIN}/?add=dinner`)
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })

  it('opens the app when no window of it is open', async () => {
    const elsewhere = appWindow('https://example.org/news')
    const { self, tap } = worker([elsewhere])

    await tap('/?add=breakfast')

    expect(elsewhere.focus).not.toHaveBeenCalled()
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/?add=breakfast`)
  })

  it.each([
    ['another site', 'https://evil.example/login'],
    ['a protocol-relative address', '//evil.example/login'],
    ['a script', 'javascript:alert(1)'],
    ['nothing at all', undefined]
  ])('only ever opens the app itself, given %s', async (_, url) => {
    const { self, tap } = worker()

    await tap(url)

    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`)
  })

  it('stays on the focused app when the browser refuses to move a window it does not control', async () => {
    const refused = vi.fn(async () => {
      throw new TypeError('This service worker is not the client\'s active service worker.')
    })
    const open = appWindow(`${ORIGIN}/`, refused)
    const { self, tap } = worker([open])

    await expect(tap('/?add=snack')).resolves.toBeTruthy()

    expect(open.focus).toHaveBeenCalled()
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })
})
