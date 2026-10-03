import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import type { AuthUser } from '~/composables/useAuth'
import type { DayView } from '~/composables/useEating'

function person(id: string): { access_token: string, token_type: string, expires_in: number, user: AuthUser } {
  return {
    access_token: `token-${id}`,
    token_type: 'bearer',
    expires_in: 900,
    user: {
      id,
      email: `${id}@example.com`,
      full_name: id,
      avatar_url: null,
      role: 'member',
      is_active: true,
      is_verified: false,
      has_password: true,
      created_at: '2026-09-01T08:00:00Z',
      onboarded_at: '2026-09-01T08:05:00Z',
      is_demo: false,
      demo_expires_at: null
    }
  }
}

const DAY: DayView = {
  day: '2026-09-21',
  totals: { kcal: 1840, protein: 0, carbs: 0, fat: 0 },
  target: null,
  meals: [],
  water_ml: 0,
  water_goal_ml: 2000,
  weight_kg: 82.4
}

const CACHE_OWNER_KEY = 'nutrijurnal-cache-owner'

beforeEach(() => {
  clearNuxtState(['auth-owner', 'auth-token', 'auth-user', 'eating-day-view', 'eating-settings', 'eating-week', 'push-state'])
  localStorage.removeItem(CACHE_OWNER_KEY)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The service worker's Cache Storage, as far as the session touches it */
function cacheStorage() {
  const deleted: string[] = []
  vi.stubGlobal('caches', {
    delete: vi.fn(async (name: string) => {
      deleted.push(name)
      return true
    })
  })
  return deleted
}

describe('one browser, two people', () => {
  it('forgets the last person’s diary when someone else signs in', () => {
    const auth = useAuthState()
    const eating = useEating()
    auth.setSession(person('ana'))
    eating.dayView.value = DAY

    auth.clearSession()
    auth.setSession(person('marko'))

    expect(eating.dayView.value).toBeNull()
  })

  it('keeps the screen when the same person signs back in', () => {
    const auth = useAuthState()
    const eating = useEating()
    auth.setSession(person('ana'))
    eating.dayView.value = DAY

    auth.clearSession()
    auth.setSession(person('ana'))

    expect(eating.dayView.value).toEqual(DAY)
  })
})

describe('the diary kept for reading offline', () => {
  it('is cleared before someone else on this browser reads anything', async () => {
    localStorage.setItem(CACHE_OWNER_KEY, 'ana')
    const deleted = cacheStorage()

    useAuthState().setSession(person('marko'))
    await flushPromises()

    expect(deleted).toEqual(['nutrijurnal-api'])
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBe('marko')
  })

  it('is kept for the person it belongs to, across a reload', async () => {
    localStorage.setItem(CACHE_OWNER_KEY, 'ana')
    const deleted = cacheStorage()

    useAuthState().setSession(person('ana'))
    await flushPromises()

    expect(deleted).toEqual([])
  })

  it('is cleared every time when the browser will not say whose it is', async () => {
    const deleted = cacheStorage()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError')
    })

    useAuthState().setSession(person('ana'))
    await flushPromises()

    expect(deleted).toEqual(['nutrijurnal-api'])
    vi.restoreAllMocks()
  })
})

describe('everything one person leaves in memory', () => {
  it('goes when someone else signs in: the week, the settings, the reminders', () => {
    const auth = useAuthState()
    const { week, settings } = useEating()
    auth.setSession(person('ana'))
    week.value = [{ day: '2026-09-21', kcal: 1840, protein: 90, carbs: 200, fat: 60, meals: 3 }]
    settings.value = { ...settings.value, target_kcal: 2300 } as typeof settings.value
    const push = useState<string>('push-state')
    push.value = 'on'

    auth.setSession(person('marko'))

    expect(week.value).toEqual([])
    expect(settings.value).toBeNull()
    expect(push.value).not.toBe('on')
  })
})

describe('a session that has ended', () => {
  it('sends the person to sign in instead of failing every tap', async () => {
    registerEndpoint('/api/v1/eating/days/2026-09-21', () => {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    })
    registerEndpoint('/api/v1/auth/refresh', {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
      }
    })
    const router = useRouter()
    await router.push('/progress')
    useAuthState().setSession(person('ana'))

    await expect(useEating().loadDay('2026-09-21')).rejects.toBeTruthy()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/progress')
  })

  it('does not take a wrong password for an ended session', async () => {
    let refreshes = 0
    registerEndpoint('/api/v1/auth/login', {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode: 401, data: { detail: 'Incorrect email or password' } })
      }
    })
    registerEndpoint('/api/v1/auth/refresh', {
      method: 'POST',
      handler: () => {
        refreshes += 1
        throw createError({ statusCode: 401 })
      }
    })

    await expect(useAuth().login({ email: 'ana@example.com', password: 'wrong-one' })).rejects.toBeTruthy()

    expect(refreshes).toBe(0)
  })
})
