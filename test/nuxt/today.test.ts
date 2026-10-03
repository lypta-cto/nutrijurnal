import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  clearNuxtState(['today', 'eating-day'])
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

function at(day: number, hour: number, minute = 0) {
  vi.setSystemTime(new Date(2026, 8, day, hour, minute))
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
