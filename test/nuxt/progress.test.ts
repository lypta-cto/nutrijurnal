import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { Progress, ProgressDay } from '~/composables/useBody'
import ProgressPage from '~/pages/progress.vue'

const THIN = ' '

function day(date: string, fields: Partial<ProgressDay> = {}): ProgressDay {
  return { day: date, meals: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, water_ml: 0, weight_kg: null, ...fields }
}

/** A week ending on Monday 21 September: three logged days, one of them over */
function week(fields: Partial<Progress> = {}): Progress {
  return {
    days: [
      day('2026-09-15'),
      day('2026-09-16'),
      day('2026-09-17'),
      day('2026-09-18'),
      day('2026-09-19', { meals: 3, kcal: 1640, protein: 110, carbs: 170, fat: 52, water_ml: 1500, weight_kg: 80.4 }),
      day('2026-09-20'),
      day('2026-09-21', { meals: 2, kcal: 2100, protein: 120, carbs: 220, fat: 70, water_ml: 2500, weight_kg: 79.8 })
    ],
    target_kcal: 2000,
    target_protein: 150,
    target_carbs: 200,
    target_fat: 67,
    water_goal_ml: 2000,
    streak: { current: 1, longest: 4, logged_today: true },
    averages: { kcal: 1870, protein: 115, carbs: 195, fat: 61, water_ml: 2000, logged_days: 2, days: 7 },
    weight: { first: { day: '2026-09-19', kg: 80.4 }, last: { day: '2026-09-21', kg: 79.8 }, change: -0.6 },
    ...fields
  }
}

function answer(body: Progress | (() => never)) {
  const asked: Record<string, string | null>[] = []
  registerEndpoint('/api/v1/eating/progress', (event) => {
    const query = new URL(event.path, 'http://test').searchParams
    asked.push({ from: query.get('from'), to: query.get('to'), today: query.get('today') })
    return typeof body === 'function' ? body() : body
  })
  return asked
}

async function open() {
  const page = await mountSuspended(ProgressPage)
  await flushPromises()
  return page
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 21, 12, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the Progress page', () => {
  it('asks for the week that ends on the viewer’s today', async () => {
    const asked = answer(week())

    await open()

    expect(asked[0]).toEqual({ from: '2026-09-15', to: '2026-09-21', today: '2026-09-21' })
  })

  it('asks for a longer period when one is chosen', async () => {
    const asked = answer(week())
    const page = await open()

    const thirty = page.findAll('[role="radio"]').find(button => button.text() === '30 days')
    await thirty?.trigger('click')
    await flushPromises()

    expect(asked.at(-1)).toEqual({ from: '2026-08-23', to: '2026-09-21', today: '2026-09-21' })
  })

  it('lists the days newest first, an empty day plainly empty', async () => {
    answer(week())
    const page = await open()

    const text = page.text()
    const today = text.indexOf('Today')
    const yesterday = text.indexOf('Yesterday')
    expect(today).toBeGreaterThan(-1)
    expect(yesterday).toBeGreaterThan(today)
    expect(text).toContain(`2${THIN}100`)
    expect(text).toContain('nothing written down')
    expect(text).toContain('79.8 kg')
  })

  it('reads every day out on the chart, the empty ones as nothing logged', async () => {
    answer(week())
    const page = await open()

    const labels = page.findAll('svg[aria-label="Kcal per day"] rect[tabindex="0"]').map(rect => rect.attributes('aria-label'))

    expect(labels).toHaveLength(7)
    expect(labels.at(-1)).toBe(`Today: 2${THIN}100`)
    expect(labels.at(-2)).toBe('Yesterday: nothing logged')
  })

  it('colours a day past the target and says how the average sits against it', async () => {
    answer(week())
    const page = await open()

    const fills = page.findAll('svg[aria-label="Kcal per day"] g.chart-grow path').map(path => path.attributes('fill'))
    expect(fills).toEqual(['var(--app-kcal)', 'var(--ui-warning)'])
    expect(page.text()).toContain('130 under target')
  })

  it('says the weight moved down with a real minus sign', async () => {
    answer(week())
    const page = await open()

    expect(page.text()).toContain('−0.6')
    expect(page.text()).toContain('since 19 Sep')
  })

  it('does not draw a trend out of a single weighing', async () => {
    answer(week({
      days: week().days.map(entry => ({ ...entry, weight_kg: entry.day === '2026-09-21' ? 79.8 : null })),
      weight: { first: { day: '2026-09-21', kg: 79.8 }, last: { day: '2026-09-21', kg: 79.8 }, change: null }
    }))
    const page = await open()

    expect(page.find('svg[aria-label="Weight in kilograms"]').exists()).toBe(false)
    expect(page.text()).toContain('One weighing so far')
  })

  it('shows an empty period as empty, not as a row of zeros', async () => {
    answer(week({
      days: week().days.map(entry => day(entry.day)),
      streak: { current: 0, longest: 0, logged_today: false },
      averages: { kcal: null, protein: null, carbs: null, fat: null, water_ml: null, logged_days: 0, days: 7 },
      weight: { first: null, last: null, change: null }
    }))
    const page = await open()

    expect(page.text()).toContain('Nothing logged in this period')
    expect(page.text()).toContain('No water logged in this period')
    expect(page.text()).toContain('Log a meal to start one')
    expect(page.find('svg[aria-label="Kcal per day"]').exists()).toBe(false)
  })

  it('offers to try again when the numbers did not arrive', async () => {
    answer(() => {
      throw createError({ statusCode: 503 })
    })
    const page = await open()

    expect(page.text()).toContain('Progress didn\'t load')
    expect(page.findAll('button').some(button => button.text().includes('Try again'))).toBe(true)
  })
})
