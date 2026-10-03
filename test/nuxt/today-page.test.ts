import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { DayView, Meal } from '~/composables/useEating'
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

describe('moving a meal to another day', () => {
  const LUNCH: Meal = {
    id: 'meal-1',
    day: '2026-09-21',
    at: null,
    title: 'Ručak',
    slot: 'lunch',
    recipe_id: null,
    recipe_title: null,
    servings: 1,
    note: null,
    has_voice: false,
    voice_seconds: null,
    voice_transcribed: false,
    items: [],
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  }

  /** The sheet is teleported out of the page, so it is read off the document */
  function moveSheet() {
    return {
      day: document.body.querySelector<HTMLInputElement>('input[aria-label="The day to move it to"]')!,
      move: [...document.body.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Move')!
    }
  }

  async function pick(value: string) {
    const { day } = moveSheet()
    day.value = value
    day.dispatchEvent(new Event('input'))
    await flushPromises()
  }

  it('will not send it to a day that hasn’t come, which an iPhone’s date wheel offers', async () => {
    const moved: unknown[] = []
    registerEndpoint('/api/v1/eating/meals/meal-1', { method: 'PATCH', handler: (event) => {
      moved.push(event.path)
      return LUNCH
    } })
    const page = await open()
    ;(page.vm as unknown as { askMove: (meal: Meal) => void }).askMove(LUNCH)
    await flushPromises()
    expect(moveSheet().day.max).toBe('2026-09-21')

    await pick('2026-09-28')

    expect(moveSheet().move.disabled).toBe(true)
    expect(document.body.textContent).toContain('That day hasn\'t come yet — pick today or an earlier day')
    moveSheet().move.click()
    await flushPromises()
    expect(moved).toEqual([])
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
