import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import type { DayView } from '~/composables/useEating'

beforeEach(() => {
  clearNuxtState(['today', 'eating-day', 'eating-day-view', 'eating-day-failed'])
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

function at(day: number, hour: number, minute = 0) {
  vi.setSystemTime(new Date(2026, 8, day, hour, minute))
}

function view(day: string, kcal: number): DayView {
  return {
    day,
    totals: { kcal, protein: 0, carbs: 0, fat: 0 },
    target: null,
    meals: [{
      id: `meal-${day}`,
      day,
      at: '08:00',
      title: 'Breakfast',
      slot: 'breakfast',
      recipe_id: null,
      recipe_title: null,
      servings: 1,
      note: null,
      has_voice: false,
      voice_seconds: null,
      voice_transcribed: false,
      items: [],
      kcal,
      protein: 0,
      carbs: 0,
      fat: 0
    }],
    water_ml: 0,
    water_goal_ml: 2000,
    weight_kg: null
  }
}

describe('an app left open overnight', () => {
  it('moves today on, and the diary with it when it was on today', () => {
    at(21, 23, 50)
    const today = useToday()
    const day = useDiaryDay()
    expect([today.value, day.value]).toEqual(['2026-09-21', '2026-09-21'])

    at(22, 7, 30)
    expect(followToday()).toBe(true)

    // Breakfast now goes onto the morning it is eaten, not onto yesterday
    expect([today.value, day.value]).toEqual(['2026-09-22', '2026-09-22'])
  })

  it('leaves the diary on an older day someone was reading', () => {
    at(21, 22, 0)
    useToday()
    const day = useDiaryDay()
    day.value = '2026-09-15'

    at(22, 8, 0)
    followToday()

    expect([useToday().value, day.value]).toEqual(['2026-09-22', '2026-09-15'])
  })

  it('changes nothing within the same day', () => {
    at(21, 8, 0)
    useToday()

    at(21, 23, 59)

    expect(followToday()).toBe(false)
    expect(useToday().value).toBe('2026-09-21')
  })

  it('catches up when the app comes back into view or gets focus', () => {
    at(21, 22, 0)
    const today = useToday()

    at(22, 6, 45)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(today.value).toBe('2026-09-22')

    at(23, 6, 45)
    window.dispatchEvent(new Event('focus'))
    expect(today.value).toBe('2026-09-23')
  })

  it('labels the day against the today it is given', () => {
    expect(dayLabel('2026-09-21', '2026-09-21')).toBe('Today')
    expect(dayLabel('2026-09-21', '2026-09-22')).toBe('Yesterday')
  })
})

describe('the day on screen', () => {
  it('never shows another day’s meals under its heading', () => {
    const eating = useEating()
    eating.dayView.value = view('2026-09-20', 1800)
    eating.day.value = '2026-09-21'

    expect(eating.meals.value).toEqual([])
    expect(eating.totals.value.kcal).toBe(0)
  })

  it('says it failed rather than reading as an empty day, until a load succeeds', async () => {
    const eating = useEating()
    eating.day.value = '2026-09-21'
    eating.dayView.value = view('2026-09-20', 1800)
    registerEndpoint('/api/v1/eating/days/2026-09-21', () => {
      throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
    })

    await expect(eating.loadDay()).rejects.toBeTruthy()

    expect(eating.dayFailed.value).toBe('2026-09-21')
    expect(eating.meals.value).toEqual([])

    registerEndpoint('/api/v1/eating/days/2026-09-21', () => view('2026-09-21', 640))
    await eating.loadDay()

    expect(eating.dayFailed.value).toBeNull()
    expect(eating.totals.value.kcal).toBe(640)
  })
})
