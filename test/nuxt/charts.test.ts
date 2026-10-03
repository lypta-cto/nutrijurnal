import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ChartPoint } from '~/composables/useChartWidth'
import { niceTicks } from '~/composables/useChartWidth'
import { formatKcal } from '~/composables/useEating'
import ChartColumns from '~/components/chart/Columns.vue'
import ChartLine from '~/components/chart/Line.vue'
import ChartSplit from '~/components/chart/Split.vue'

function points(values: (number | null)[]): ChartPoint[] {
  return values.map((value, index) => ({
    key: `2026-09-${String(15 + index).padStart(2, '0')}`,
    // Letters, as a week's axis reads, so they never pass for gridline values
    label: 'MTWTFSS'[index % 7]!,
    title: `Day ${15 + index}`,
    value
  }))
}

describe('round axis values', () => {
  it('steps by 1, 2, 2.5 or 5 times a power of ten', () => {
    expect(niceTicks(0, 2100, 3)).toEqual([0, 1000, 2000])
    expect(niceTicks(0, 2500, 3)).toEqual([0, 1000, 2000])
    expect(niceTicks(0, 3200, 3)).toEqual([0, 2000])
    expect(niceTicks(0, 750, 3)).toEqual([0, 250, 500, 750])
  })

  it('hugs a narrow range of decimals without float noise', () => {
    expect(niceTicks(69.1, 70.9, 6)).toEqual([69.5, 70, 70.5])
    expect(niceTicks(78.9, 81.1, 3)).toEqual([79, 80, 81])
    expect(niceTicks(0, 0.7, 3)).toEqual([0, 0.25, 0.5])
  })

  it('is a single value for a flat or backwards range', () => {
    expect(niceTicks(5, 5)).toEqual([5])
    expect(niceTicks(9, 3)).toEqual([9])
  })
})

describe('columns per day', () => {
  async function columns(values: (number | null)[], extra: Record<string, unknown> = {}) {
    return mountSuspended(ChartColumns, {
      props: { points: points(values), color: 'var(--app-kcal)', format: formatKcal, label: 'Kcal per day', ...extra }
    })
  }

  it('draws a column for each day with something in it and none for an empty day', async () => {
    const chart = await columns([1800, null, 2100, 0])

    const drawn = chart.findAll('g.chart-grow path')
    expect(drawn).toHaveLength(2)
    expect(drawn.every(path => path.attributes('fill') === 'var(--app-kcal)')).toBe(true)
  })

  it('turns the days past the target the warning colour', async () => {
    const chart = await columns([1800, 2400, 2000], {
      overColor: 'var(--ui-warning)',
      reference: { value: 2000, label: 'Target 2 000' }
    })

    const fills = chart.findAll('g.chart-grow path').map(path => path.attributes('fill'))
    // Exactly on target is within it
    expect(fills).toEqual(['var(--app-kcal)', 'var(--ui-warning)', 'var(--app-kcal)'])
    expect(chart.text()).toContain('Target 2 000')
  })

  it('gives every day a thumb-sized target that reads its value out', async () => {
    const chart = await columns([2140, null])

    const targets = chart.findAll('rect[tabindex="0"]').map(rect => rect.attributes('aria-label'))
    expect(targets).toEqual(['Day 15: 2 140', 'Day 16: nothing logged'])
    expect(chart.find('svg').attributes('role')).toBe('img')
    expect(chart.find('svg').attributes('aria-label')).toBe('Kcal per day')
  })

  it('reaches its top gridline past the tallest column and the target', async () => {
    const chart = await columns([1900, 3150], { reference: { value: 2000, label: 'Target' } })

    const gridValues = chart.findAll('g[aria-hidden="true"] text')
      .map(text => Number(text.text().replace(/\s/g, '')))
      .filter(Number.isFinite)
    expect(Math.max(...gridValues)).toBeGreaterThanOrEqual(3150)
  })

  it('says the day and its note when a column is touched', async () => {
    const chart = await mountSuspended(ChartColumns, {
      props: {
        points: [{ key: 'a', label: 'M', title: 'Mon 21 Sep', value: 2100, detail: '100 over' }],
        color: 'var(--app-kcal)',
        format: formatKcal,
        label: 'Kcal per day'
      }
    })

    await chart.find('rect[tabindex="0"]').trigger('focus')

    const tooltip = chart.find('[role="status"]')
    expect(tooltip.text()).toContain('2 100')
    expect(tooltip.text()).toContain('Mon 21 Sep')
    expect(tooltip.text()).toContain('100 over')
  })
})

describe('the weight line', () => {
  it('skips the days nobody weighed in and carries on to the next', async () => {
    const chart = await mountSuspended(ChartLine, {
      props: { points: points([80.4, null, null, 79.9, null, 79.6]), color: 'currentColor', format: (value: number) => value.toFixed(1), label: 'Weight in kilograms' }
    })

    const line = chart.findAll('path').map(path => path.attributes('d') ?? '').find(d => d.startsWith('M'))
    expect(line?.match(/[ML]/g)).toEqual(['M', 'L', 'L'])
  })

  it('hugs the weights rather than starting from zero', async () => {
    const chart = await mountSuspended(ChartLine, {
      props: { points: points([80.4, 79.9, 79.6]), color: 'currentColor', format: (value: number) => value.toFixed(1), label: 'Weight in kilograms' }
    })

    const gridValues = chart.findAll('text').map(text => Number(text.text())).filter(value => Number.isFinite(value) && value > 0)
    expect(Math.min(...gridValues)).toBeGreaterThan(75)
    expect(Math.max(...gridValues)).toBeLessThan(85)
  })
})

describe('where the energy came from', () => {
  const MACROS = [
    { key: 'protein', label: 'Protein', energy: 4, color: 'var(--app-protein)' },
    { key: 'carbs', label: 'Carbs', energy: 4, color: 'var(--app-carbs)' },
    { key: 'fat', label: 'Fat', energy: 9, color: 'var(--app-fat)' }
  ]

  it('splits by energy, not by grams — a gram of fat is worth more than two of carbs', async () => {
    const parts = MACROS.map((macro, index) => ({ ...macro, grams: [100, 200, 400 / 9][index]!, goal: null }))

    const chart = await mountSuspended(ChartSplit, { props: { parts } })

    expect(chart.find('[role="img"]').attributes('aria-label')).toBe('Protein 25%, Carbs 50%, Fat 25%')
  })

  it('sets the target’s own shares beside them', async () => {
    const parts = MACROS.map((macro, index) => ({ ...macro, grams: [100, 200, 400 / 9][index]!, goal: [150, 200, 600 / 9][index]! }))

    const chart = await mountSuspended(ChartSplit, { props: { parts } })

    // 600 · 800 · 600 kcal of target → 30 · 40 · 30
    expect(chart.text()).toMatch(/30%/)
    expect(chart.text()).toMatch(/40%/)
  })

  it('is all zeros rather than NaN on a day with nothing eaten', async () => {
    const parts = MACROS.map(macro => ({ ...macro, grams: 0, goal: null }))

    const chart = await mountSuspended(ChartSplit, { props: { parts } })

    expect(chart.find('[role="img"]').attributes('aria-label')).toBe('Protein 0%, Carbs 0%, Fat 0%')
    expect(chart.text()).not.toContain('NaN')
  })
})
