import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { Food } from '~/composables/useEating'
import { changedTargets, targetsOf } from '~/composables/useEating'
import LibraryPage from '~/pages/library.vue'
import CopyMealsPanel from '~/components/CopyMealsPanel.vue'
import QuickAddSheet from '~/components/QuickAddSheet.vue'
import WaterCard from '~/components/WaterCard.vue'
import WeightCard from '~/components/WeightCard.vue'

describe('saving the daily targets', () => {
  it('sends only the targets that were changed', () => {
    const before = { target_kcal: 2000, target_protein: 150, target_carbs: 200, target_fat: 67 }

    expect(changedTargets({ ...before, target_kcal: 1900 }, before)).toEqual({ target_kcal: 1900 })
    expect(changedTargets({ ...before, target_carbs: null }, before)).toEqual({ target_carbs: null })
    expect(changedTargets(before, before)).toEqual({})
  })

  it('never wipes the others when the settings never loaded', () => {
    // A failed load leaves the form all-null; setting one target must not
    // send nulls for the other three
    const blank = targetsOf(null)

    expect(changedTargets({ ...blank, target_kcal: 2100 }, blank)).toEqual({ target_kcal: 2100 })
  })
})

describe('a Library shelf that could not be read', () => {
  it('says so instead of reading as an empty cookbook', async () => {
    registerEndpoint('/api/v1/eating/recipes', () => {
      throw createError({ statusCode: 503 })
    })
    registerEndpoint('/api/v1/eating/foods', () => [])

    const page = await mountSuspended(LibraryPage)
    await flushPromises()

    expect(page.text()).toContain('Your recipes didn\'t load')
    expect(page.text()).not.toContain('No recipes yet')
  })

  it('shows the empty cookbook only when it really is empty', async () => {
    registerEndpoint('/api/v1/eating/recipes', () => [])
    registerEndpoint('/api/v1/eating/foods', () => [])

    const page = await mountSuspended(LibraryPage)
    await flushPromises()

    expect(page.text()).toContain('No recipes yet')
  })
})

function food(id: string, name: string): Food {
  return {
    id,
    name,
    name_en: null,
    brand: null,
    base_unit: 'g',
    units: {},
    barcode: null,
    source: 'seed',
    mine: false,
    archived: false,
    favourite: false,
    kcal: 100,
    protein: 10,
    carbs: 10,
    fat: 1
  }
}

describe('searching the pantry while typing', () => {
  it('never lets a slow answer to an older word land over the newer one', async () => {
    registerEndpoint('/api/v1/eating/recipes', () => [])
    registerEndpoint('/api/v1/eating/foods', async (event) => {
      const q = new URL(event.path, 'http://test').searchParams.get('q')
      if (q === 'pil') {
        // The first word's answer is still on its way when the second is typed
        await new Promise(resolve => setTimeout(resolve, 400))
        return [food('chicken', 'Pileći file')]
      }
      return q === 'pire' ? [food('mash', 'Pire krompir')] : []
    })
    const page = await mountSuspended(LibraryPage)
    await page.findAll('[role="radio"]').find(option => option.text() === 'Foods')?.trigger('click')
    await flushPromises()
    const search = page.find('input[placeholder="Search foods…"]')

    await search.setValue('pil')
    await new Promise(resolve => setTimeout(resolve, 300))
    await search.setValue('pire')
    await vi.waitFor(() => expect(page.text()).toContain('Pire krompir'))
    // …and once the older answer has arrived too
    await new Promise(resolve => setTimeout(resolve, 450))
    await flushPromises()

    expect(page.text()).toContain('Pire krompir')
    expect(page.text()).not.toContain('Pileći file')
  })
})

/** An endpoint that is down until told otherwise, then answers with `body` */
function flaky<T>(path: string, body: () => T) {
  const state = { down: true }
  registerEndpoint(path, () => {
    if (state.down) {
      throw createError({ statusCode: 503 })
    }
    return body()
  })
  return state
}

async function tryAgain(find: () => { trigger: (event: string) => Promise<void> } | undefined) {
  await find()!.trigger('click')
  await flushPromises()
}

describe('a card or a panel that could not be read', () => {
  it('says the water didn’t load rather than that none was drunk', async () => {
    const water = flaky('/api/v1/eating/water/2026-09-21', () => ({ day: '2026-09-21', ml: 500, goal_ml: 2000, glass_ml: 250, entries: [] }))

    const card = await mountSuspended(WaterCard, { props: { day: '2026-09-21' } })
    await vi.waitFor(() => expect(card.text()).toContain('The water didn\'t load'), { timeout: 2000 })
    expect(card.text()).not.toContain('0 ml of')

    water.down = false
    await tryAgain(() => card.findAll('button').find(button => button.text() === 'Try again'))
    await vi.waitFor(() => expect(card.text()).toContain('500 ml of 2 l'))
    card.unmount()
  })

  it('says the weighings didn’t load rather than that there are none', async () => {
    const weights = flaky('/api/v1/eating/weight', () => [{ day: '2026-09-21', kg: 72.4 }])

    const card = await mountSuspended(WeightCard, { props: { day: '2026-09-21' } })
    await vi.waitFor(() => expect(card.text()).toContain('Your weighings didn\'t load'), { timeout: 2000 })
    expect(card.text()).not.toContain('Weigh in once a week')

    weights.down = false
    await tryAgain(() => card.findAll('button').find(button => button.text() === 'Try again'))
    await vi.waitFor(() => expect(card.text()).toContain('72.4'))
    card.unmount()
  })

  it('says the day to copy from didn’t load rather than that nothing was eaten', async () => {
    const day = flaky('/api/v1/eating/days/2026-09-20', () => ({ day: '2026-09-20', meals: [] }))

    const panel = await mountSuspended(CopyMealsPanel, { props: { day: '2026-09-21' } })
    await vi.waitFor(() => expect(panel.text()).toContain('That day didn\'t load'), { timeout: 2000 })
    expect(panel.text()).not.toContain('Nothing written down that day')

    day.down = false
    await tryAgain(() => panel.findAll('button').find(button => button.text() === 'Try again'))
    await vi.waitFor(() => expect(panel.text()).toContain('Nothing written down that day'))
    panel.unmount()
  })

  it('says the starred and recent foods didn’t load rather than that there are none yet', async () => {
    clearNuxtState(['quick-add-open', 'quick-add-kind', 'quick-add-slot'])
    const lists = flaky('/api/v1/eating/foods/quick', () => ({ favourites: [], recent: [food('egg', 'Jaje')] }))
    registerEndpoint(`/api/v1/eating/days/${shiftDay(useDiaryDay().value, -1)}`, () => ({ meals: [] }))
    const sheet = await mountSuspended(QuickAddSheet)
    useQuickAdd().open()
    const text = () => document.body.textContent ?? ''

    await vi.waitFor(() => expect(text()).toContain('Your foods didn\'t load'), { timeout: 2000 })
    expect(text()).not.toContain('No recent foods yet')

    lists.down = false
    ;[...document.body.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Try again')!.click()
    await vi.waitFor(() => expect(text()).toContain('Jaje'))
    useQuickAdd().close()
    sheet.unmount()
  })
})
