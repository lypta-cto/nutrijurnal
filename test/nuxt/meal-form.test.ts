import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import type { Food, Meal, MealPayload, ParseResult } from '~/composables/useEating'
import { shiftDay } from '~/composables/useEating'
import MealForm from '~/components/MealForm.vue'

/** A meal already in the diary, opened to be edited */
const LUNCH: Meal = {
  id: 'meal-1',
  day: '2026-09-21',
  at: '13:00:00',
  title: 'Lunch',
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

const mounted: { unmount: () => void }[] = []

afterEach(() => {
  mounted.splice(0).forEach(form => form.unmount())
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * The pantry as the API answers it: "pil" (the first thing typed) answers
 * late — or not at all — and "pire" (typed next) at once.
 */
function pantry(older: 'late' | 'fails') {
  registerEndpoint('/api/v1/eating/foods', async (event) => {
    const q = new URL(event.path, 'http://test').searchParams.get('q')
    if (q === 'pil') {
      await wait(400)
      if (older === 'fails') {
        throw createError({ statusCode: 503 })
      }
      return [food('chicken', 'Pileći file')]
    }
    return q === 'pire' ? [food('mash', 'Pire krompir')] : []
  })
}

function searchField() {
  return document.body.querySelector<HTMLInputElement>('input[placeholder^="Search foods"]')!
}

async function searchFor(...words: string[]) {
  const field = searchField()
  for (const word of words) {
    field.value = word
    field.dispatchEvent(new Event('input'))
    await wait(300)
  }
}

/** The sheet is teleported out of the component, so it is read off the page */
function sheet() {
  return {
    day: document.body.querySelector<HTMLInputElement>('input[type="date"][aria-label="Day"]'),
    save: document.body.querySelector<HTMLButtonElement>('button[type="submit"][form="form-sheet"]')
  }
}

describe('the meal form on a phone', () => {
  it('will not save a meal whose date field was cleared', async () => {
    mounted.push(await mountSuspended(MealForm, { props: { open: true, day: '2026-09-21', meal: LUNCH } }))
    await flushPromises()
    const { day, save } = sheet()
    expect(day?.value).toBe('2026-09-21')
    expect(save?.disabled).toBe(false)

    // iOS and Android both offer a "Clear" on their date pickers
    day!.value = ''
    day!.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(sheet().save?.disabled).toBe(true)
  })

  it('will not save a meal on a day that hasn’t come, which an iPhone’s date wheel offers', async () => {
    mounted.push(await mountSuspended(MealForm, { props: { open: true, day: '2026-09-21', meal: LUNCH } }))
    await flushPromises()
    const { day } = sheet()
    const today = useToday().value
    expect(day?.max).toBe(today)

    day!.value = shiftDay(today, 1)
    day!.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(sheet().save?.disabled).toBe(true)
    expect(document.body.textContent).toContain('That day hasn\'t come yet — pick today or an earlier day')

    day!.value = today
    day!.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(sheet().save?.disabled).toBe(false)
  })

  it('saved while a typed line is still being read, waits for the foods in it', async () => {
    const parsed: ParseResult = {
      items: [{ food_id: 'oats', label: 'Ovsene pahuljice', quantity: 50, unit: 'g', grams: 50, kcal: 189.5, protein: 6.6, carbs: 33.9, fat: 3.3 }],
      unknown: [],
      slot: null
    }
    // The parser answers slowly, the way a phone on a train does
    registerEndpoint('/api/v1/eating/parse', {
      method: 'POST',
      handler: async () => {
        await new Promise(resolve => setTimeout(resolve, 60))
        return parsed
      }
    })
    const sent: MealPayload[] = []
    registerEndpoint('/api/v1/eating/meals', {
      method: 'POST',
      handler: async (event) => {
        const payload = await readBody<MealPayload>(event)
        sent.push(payload)
        return { ...LUNCH, id: 'meal-2', title: 'Breakfast', slot: payload.slot ?? 'breakfast' }
      }
    })
    mounted.push(await mountSuspended(MealForm, { props: { open: true, day: '2026-09-21', start: 'type' } }))
    await flushPromises()
    const line = document.body.querySelector('textarea')!
    line.value = '50g ovsenih'
    line.dispatchEvent(new Event('input'))
    await flushPromises()

    const read = [...document.body.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Read')
    read!.click()
    // Tapped before the foods arrived
    document.body.querySelector('form#form-sheet')!.dispatchEvent(new Event('submit', { cancelable: true }))

    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.items).toEqual([{ food_id: 'oats', label: 'Ovsene pahuljice', quantity: 50, unit: 'g' }])
    expect(sent[0]?.note ?? null).toBeNull()
  })

  it('never lets a slow answer to an older word land over the newer one', async () => {
    pantry('late')
    mounted.push(await mountSuspended(MealForm, { props: { open: true, day: '2026-09-21' } }))
    await flushPromises()

    await searchFor('pil', 'pire')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Pire krompir'))
    await wait(200)
    await flushPromises()

    expect(document.body.textContent).toContain('Pire krompir')
    expect(document.body.textContent).not.toContain('Pileći file')
  })

  it('keeps the newer word’s foods when an older search fails late', async () => {
    pantry('fails')
    mounted.push(await mountSuspended(MealForm, { props: { open: true, day: '2026-09-21' } }))
    await flushPromises()

    await searchFor('pil', 'pire')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Pire krompir'))
    // A failed GET is tried once more before it gives up
    await wait(900)
    await flushPromises()

    expect(document.body.textContent).toContain('Pire krompir')
    expect(document.body.textContent).not.toContain('Not in the pantry yet')
    expect(document.body.textContent).not.toContain('The search didn\'t load')
  })

  it('stops the spinner when the field is cleared while a search is on its way', async () => {
    pantry('late')
    mounted.push(await mountSuspended(MealForm, { props: { open: true, day: '2026-09-21' } }))
    await flushPromises()
    const spinning = () => searchField().parentElement!.querySelector('.animate-spin')

    await searchFor('pil')
    expect(spinning()).not.toBeNull()
    await searchFor('')
    await flushPromises()
    expect(spinning()).toBeNull()

    // …and the answer to the word that is gone never lands
    await wait(300)
    await flushPromises()
    expect(spinning()).toBeNull()
    expect(document.body.textContent).not.toContain('Pileći file')
  })

  it('says the search failed rather than that the pantry has no such food', async () => {
    let down = true
    registerEndpoint('/api/v1/eating/foods', () => {
      if (down) {
        throw createError({ statusCode: 503 })
      }
      return [food('chicken', 'Pileći file')]
    })
    mounted.push(await mountSuspended(MealForm, { props: { open: true, day: '2026-09-21' } }))
    await flushPromises()

    await searchFor('pil')
    await vi.waitFor(() => expect(document.body.textContent).toContain('The search didn\'t load'), { timeout: 2000 })
    expect(document.body.textContent).not.toContain('Not in the pantry yet')

    down = false
    const retry = [...document.body.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Try again')
    retry!.click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Pileći file'))
    expect(document.body.textContent).not.toContain('The search didn\'t load')
  })
})
