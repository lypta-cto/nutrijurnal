import { beforeEach, describe, expect, it } from 'vitest'
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

beforeEach(() => {
  clearNuxtState(['auth-owner', 'auth-token', 'auth-user', 'eating-day-view', 'eating-settings'])
})

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
