import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { DayView } from '~/composables/useEating'
import TodayPage from '~/pages/index.vue'

function empty(day: string): DayView {
  return {
    day,
    totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    target: null,
    meals: [],
    water_ml: 0,
    water_goal_ml: 2000,
    weight_kg: null
  }
}

const mounted: { unmount: () => void }[] = []

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 21, 12, 0))
  clearNuxtState(['today', 'eating-day', 'eating-day-view', 'eating-day-failed', 'eating-week'])
  registerEndpoint('/api/v1/eating/settings', () => ({
    target_kcal: 2000,
    target_protein: null,
    target_carbs: null,
    target_fat: null,
    onboarded_at: '2026-09-01T08:00:00Z',
    profile: null,
    water_goal_ml: 2000,
    water_glass_ml: 250,
    timezone: 'Europe/Belgrade'
  }))
  registerEndpoint('/api/v1/eating/days', () => [])
  for (const day of ['2026-09-14', '2026-09-15', '2026-09-20', '2026-09-21']) {
    registerEndpoint(`/api/v1/eating/days/${day}`, () => empty(day))
  }
})

afterEach(() => {
  mounted.splice(0).forEach(page => page.unmount())
  vi.useRealTimers()
})

async function open() {
  const page = await mountSuspended(TodayPage)
  mounted.push(page)
  await flushPromises()
  return page
}

describe('picking a day on Today', () => {
  it('opens a day that has been', async () => {
    const page = await open()

    await page.find('input[aria-label="Pick a day"]').setValue('2026-09-15')
    await page.find('input[aria-label="Pick a day"]').trigger('change')

    expect(useDiaryDay().value).toBe('2026-09-15')
  })

  it('stays put when the iOS date wheel offers next week, which ignores the field’s max', async () => {
    const page = await open()
    const picker = page.find('input[aria-label="Pick a day"]')
    expect(picker.attributes('max')).toBe('2026-09-21')

    await picker.setValue('2026-09-28')
    await picker.trigger('change')

    expect(useDiaryDay().value).toBe('2026-09-21')
  })

  it('stays put when the picker is cleared', async () => {
    const page = await open()
    const picker = page.find('input[aria-label="Pick a day"]')

    await picker.setValue('')
    await picker.trigger('change')

    expect(useDiaryDay().value).toBe('2026-09-21')
  })
})

describe('a day that did not load', () => {
  it('says so and offers to try again, instead of showing an empty day', async () => {
    let down = true
    registerEndpoint('/api/v1/eating/days/2026-09-21', () => {
      if (down) {
        throw createError({ statusCode: 503 })
      }
      return { ...empty('2026-09-21'), totals: { kcal: 640, protein: 0, carbs: 0, fat: 0 } }
    })
    const page = await open()
    // A failed GET is tried once more before it gives up
    await vi.waitFor(() => expect(page.text()).toContain('This day didn\'t load'))
    expect(page.text()).not.toContain('0 kcal eaten')

    down = false
    const retry = page.findAll('button').find(button => button.text().includes('Try again'))
    await retry!.trigger('click')
    await flushPromises()

    await vi.waitFor(() => expect(page.text()).not.toContain('This day didn\'t load'))
  })
})
