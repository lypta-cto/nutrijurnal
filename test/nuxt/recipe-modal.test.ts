import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import type { ParseResult, Recipe, RecipePayload } from '~/composables/useEating'
import { shiftDay } from '~/composables/useEating'
import RecipeModal from '~/components/RecipeModal.vue'

const OMELETTE: Recipe = {
  id: 'recipe-1',
  title: 'Omlet',
  subtitle: null,
  servings: 1,
  serving_unit: 'serving',
  minutes: null,
  steps: [],
  note: null,
  items: [],
  stated: null,
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0
}

const PARSED: ParseResult = {
  items: [{ food_id: 'egg', label: 'Jaje', quantity: 2, unit: 'piece', grams: 110, kcal: 170.5, protein: 14.3, carbs: 1.2, fat: 12.1 }],
  unknown: [],
  slot: null
}

/** The sheet is teleported out of the component, so it is read off the page */
function button(label: string) {
  const found = [...document.body.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === label)
  if (!found) {
    throw new Error(`No "${label}" button in the sheet`)
  }
  return found
}

describe('a recipe, open', () => {
  it('saved while the list is still being read, keeps the rows read from it', async () => {
    registerEndpoint('/api/v1/eating/recipes/recipe-1', { method: 'GET', handler: () => OMELETTE })
    // The parser answers slowly, the way a phone on a train does
    registerEndpoint('/api/v1/eating/parse', {
      method: 'POST',
      handler: async () => {
        await new Promise(resolve => setTimeout(resolve, 60))
        return PARSED
      }
    })
    const saved: RecipePayload[] = []
    registerEndpoint('/api/v1/eating/recipes/recipe-1', {
      method: 'PATCH',
      handler: async (event) => {
        const payload = await readBody<RecipePayload>(event)
        saved.push(payload)
        return { ...OMELETTE, items: [{ id: 'item-1', food_id: 'egg', label: 'Jaje', quantity: 2, unit: 'piece', grams: 110, optional: false }] }
      }
    })
    const sheet = await mountSuspended(RecipeModal, { props: { recipe: OMELETTE, open: false } })
    await sheet.setProps({ open: true })
    await flushPromises()

    button('Paste').click()
    await flushPromises()
    const list = document.body.querySelector<HTMLInputElement>('input[aria-label="The whole ingredient list"]')!
    list.value = '2 jaja'
    list.dispatchEvent(new Event('input'))
    await flushPromises()
    list.form!.dispatchEvent(new Event('submit', { cancelable: true }))
    // Tapped before the rows arrived
    button('Save').click()

    await vi.waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]?.items).toEqual([{ food_id: 'egg', label: 'Jaje', quantity: 2, unit: 'piece', optional: false }])
    sheet.unmount()
  })

  it('will not put the dish on a day whose date field was cleared', async () => {
    registerEndpoint('/api/v1/eating/recipes/recipe-1', { method: 'GET', handler: () => OMELETTE })
    const sheet = await mountSuspended(RecipeModal, { props: { recipe: OMELETTE, open: false } })
    await sheet.setProps({ open: true })
    await flushPromises()

    button('Add to diary').click()
    await flushPromises()
    expect(button('Write it down').disabled).toBe(false)

    const day = document.body.querySelector<HTMLInputElement>('input[type="date"][aria-label="Day"]')!
    day.value = ''
    day.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(button('Write it down').disabled).toBe(true)
    sheet.unmount()
  })

  it('will not put the dish on a day that hasn’t come', async () => {
    registerEndpoint('/api/v1/eating/recipes/recipe-1', { method: 'GET', handler: () => OMELETTE })
    const sheet = await mountSuspended(RecipeModal, { props: { recipe: OMELETTE, open: false } })
    await sheet.setProps({ open: true })
    await flushPromises()

    button('Add to diary').click()
    await flushPromises()
    const day = document.body.querySelector<HTMLInputElement>('input[type="date"][aria-label="Day"]')!
    const today = useToday().value
    expect(day.max).toBe(today)

    day.value = shiftDay(today, 7)
    day.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(button('Write it down').disabled).toBe(true)
    expect(document.body.textContent).toContain('That day hasn\'t come yet — pick today or an earlier day')
    sheet.unmount()
  })
})
