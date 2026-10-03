import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { clockNow, dayLabel, dayShort, shiftDay, slotForNow, timeLabel } from '~/composables/useEating'
import { clockOf } from '~/composables/useVoiceNote'

const BELGRADE = 'Europe/Belgrade'

/** Lives a test in another timezone; Node rereads TZ whenever it is assigned */
function inZone(zone: string) {
  process.env.TZ = zone
}

afterEach(() => {
  inZone(BELGRADE)
  vi.useRealTimers()
})

describe('the viewer’s own day', () => {
  it('is the local date, not London’s', () => {
    // 22:30 UTC is already half past midnight in Belgrade
    expect(localIsoDay(new Date('2026-09-21T22:30:00Z'))).toBe('2026-09-22')
    expect(localIsoDay(new Date('2026-09-21T21:59:00Z'))).toBe('2026-09-21')
  })

  it('holds at either end of the world', () => {
    inZone('Pacific/Kiritimati') // UTC+14
    expect(localIsoDay(new Date('2026-09-21T11:00:00Z'))).toBe('2026-09-22')
    inZone('Pacific/Pago_Pago') // UTC−11
    expect(localIsoDay(new Date('2026-09-21T09:00:00Z'))).toBe('2026-09-20')
  })

  it('pads single-digit months and days', () => {
    expect(localIsoDay(new Date(2027, 0, 5, 9))).toBe('2027-01-05')
  })
})

describe('moving by whole days', () => {
  it('crosses months, years and leap days', () => {
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29')
    expect(shiftDay('2026-09-21', -365)).toBe('2025-09-21')
    expect(shiftDay('2026-09-21', 0)).toBe('2026-09-21')
  })

  it('steps over both clock changes without losing or doubling a day', () => {
    expect(shiftDay('2026-03-28', 1)).toBe('2026-03-29')
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDay('2026-10-24', 1)).toBe('2026-10-25')
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')
    expect(shiftDay('2026-10-26', -2)).toBe('2026-10-24')
  })

  it('steps over a clock change that happens at midnight', () => {
    // Chile springs forward at 24:00, so that midnight never happens there
    inZone('America/Santiago')
    expect(shiftDay('2026-09-05', 1)).toBe('2026-09-06')
    expect(shiftDay('2026-09-06', -1)).toBe('2026-09-05')
  })
})

describe('naming a day', () => {
  it('says Today, Yesterday and Tomorrow around the viewer’s today', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-21T22:30:00Z')) // 00:30 on the 22nd in Belgrade

    expect(dayLabel('2026-09-22')).toBe('Today')
    expect(dayLabel('2026-09-21')).toBe('Yesterday')
    expect(dayLabel('2026-09-23')).toBe('Tomorrow')
    expect(dayLabel('2026-09-18')).toMatch(/^Fri 18 Sep/)
  })

  it('writes a short date, never the ISO string', () => {
    expect(dayShort('2026-09-12')).toMatch(/^12 Sep/)
    expect(dayShort('2027-01-01')).toBe('1 Jan')
  })
})

describe('clock and slot', () => {
  it('shows a meal’s time as hours and minutes, or a dash', () => {
    expect(timeLabel('08:30:00')).toBe('08:30')
    expect(timeLabel('19:05')).toBe('19:05')
    expect(timeLabel(null)).toBe('—')
  })

  it('times a meal written down now in the viewer’s clock', () => {
    expect(clockNow(new Date(2026, 8, 21, 8, 5))).toBe('08:05')
    expect(clockNow(new Date(2026, 8, 21, 23, 59))).toBe('23:59')
  })

  it('suggests the slot by the same hours the API uses', () => {
    const at = (hour: number, minute = 0) => slotForNow(new Date(2026, 8, 21, hour, minute))

    expect([at(0), at(6), at(10, 59)]).toEqual(['breakfast', 'breakfast', 'breakfast'])
    expect([at(11), at(15, 59)]).toEqual(['lunch', 'lunch'])
    expect([at(16), at(20, 59)]).toEqual(['dinner', 'dinner'])
    expect([at(21), at(23, 59)]).toEqual(['snack', 'snack'])
  })

  it('reads a recording’s length in minutes and seconds', () => {
    expect(clockOf(0)).toBe('0:00')
    expect(clockOf(7.4)).toBe('0:07')
    expect(clockOf(59.6)).toBe('1:00')
    expect(clockOf(67)).toBe('1:07')
    expect(clockOf(-3)).toBe('0:00')
  })
})

describe('the week strip', () => {
  function answerDays(known: { day: string, kcal: number }[] = []) {
    const asked: { from: string | null, to: string | null }[] = []
    registerEndpoint('/api/v1/eating/days', (event) => {
      const query = new URL(event.path, 'http://test').searchParams
      asked.push({ from: query.get('from'), to: query.get('to') })
      return known.map(entry => ({ ...entry, meals: 1, protein: 0, carbs: 0, fat: 0 }))
    })
    return asked
  }

  it('is the calendar week, Monday first, whichever day is open', async () => {
    const asked = answerDays()
    const { loadWeek } = useEating()

    await loadWeek('2026-09-27') // a Sunday
    await loadWeek('2026-09-21') // a Monday
    await loadWeek('2026-09-24') // a Thursday

    expect(asked).toEqual([
      { from: '2026-09-21', to: '2026-09-27' },
      { from: '2026-09-21', to: '2026-09-27' },
      { from: '2026-09-21', to: '2026-09-27' }
    ])
  })

  it('keeps a week that spans the autumn clock change at seven days', async () => {
    const asked = answerDays([{ day: '2026-10-25', kcal: 1800 }])
    const { loadWeek } = useEating()

    const week = await loadWeek('2026-10-25')

    expect(asked[0]).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(week.map(entry => entry.day)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'
    ])
    expect(week.at(-1)?.kcal).toBe(1800)
    expect(week.slice(0, 6).every(entry => entry.meals === 0 && entry.kcal === 0)).toBe(true)
  })

  it('reads a range that failed to load as empty days, not a broken page', async () => {
    registerEndpoint('/api/v1/eating/days', () => {
      throw createError({ statusCode: 500 })
    })
    const { loadRange } = useEating()

    const days = await loadRange('2026-09-21', '2026-09-23')

    expect(days.map(entry => [entry.day, entry.meals])).toEqual([
      ['2026-09-21', 0],
      ['2026-09-22', 0],
      ['2026-09-23', 0]
    ])
  })
})
