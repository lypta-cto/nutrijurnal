import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { Food } from '~/composables/useEating'
import QuickAddSheet from '~/components/QuickAddSheet.vue'

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
const mounted: { unmount: () => void }[] = []

beforeEach(() => {
  clearNuxtState(['quick-add-open', 'quick-add-kind', 'quick-add-slot', 'quick-add-saved-at'])
  registerEndpoint('/api/v1/eating/foods/quick', () => ({ favourites: [], recent: [] }))
  registerEndpoint(`/api/v1/eating/days/${shiftDay(useDiaryDay().value, -1)}`, () => ({ meals: [] }))
})

afterEach(() => {
  useQuickAdd().close()
  mounted.splice(0).forEach(sheet => sheet.unmount())
})

/** The sheet is teleported out of the component, so it is read off the page */
const text = () => document.body.textContent ?? ''

async function openSheet() {
  mounted.push(await mountSuspended(QuickAddSheet))
  useQuickAdd().open()
  await flushPromises()
}

async function searchFor(...words: string[]) {
  const field = document.body.querySelector<HTMLInputElement>('input[placeholder^="Search foods"]')!
  for (const word of words) {
    field.value = word
    field.dispatchEvent(new Event('input'))
    await wait(250)
  }
}

describe('searching in the "+" sheet', () => {
  it('keeps the newer word’s foods when an older search fails late', async () => {
    registerEndpoint('/api/v1/eating/foods', async (event) => {
      const q = new URL(event.path, 'http://test').searchParams.get('q')
      if (q === 'pil') {
        await wait(400)
        throw createError({ statusCode: 503 })
      }
      return q === 'pire' ? [food('mash', 'Pire krompir')] : []
    })
    await openSheet()

    await searchFor('pil', 'pire')
    await vi.waitFor(() => expect(text()).toContain('Pire krompir'))
    // A failed GET is tried once more before it gives up
    await wait(900)
    await flushPromises()

    expect(text()).toContain('Pire krompir')
    expect(text()).not.toContain('Not in the pantry yet')
    expect(text()).not.toContain('The search didn\'t load')
  })

  it('says the search failed rather than that the pantry has no such food', async () => {
    registerEndpoint('/api/v1/eating/foods', () => {
      throw createError({ statusCode: 503 })
    })
    await openSheet()

    await searchFor('pil')

    await vi.waitFor(() => expect(text()).toContain('The search didn\'t load'), { timeout: 2000 })
    expect(text()).not.toContain('Not in the pantry yet')
  })
})

describe('the "+" sheet and the back gesture', () => {
  it('closes on Back instead of leaving the page under it', async () => {
    const page = useRouter().currentRoute.value.fullPath
    await openSheet()
    expect(useQuickAdd().isOpen.value).toBe(true)

    history.back()

    await vi.waitFor(() => expect(useQuickAdd().isOpen.value).toBe(false))
    expect(useRouter().currentRoute.value.fullPath).toBe(page)
  })
})

describe('starring in the "+" sheet', () => {
  it('puts a failed star back in the Recent list, not only in search results', async () => {
    registerEndpoint('/api/v1/eating/foods/quick', () => ({ favourites: [], recent: [food('banana', 'Banana')] }))
    registerEndpoint('/api/v1/eating/foods/banana/favourite', {
      method: 'PUT',
      handler: () => {
        throw createError({ statusCode: 500, statusMessage: 'down' })
      }
    })
    await openSheet()
    await wait(50)

    document.body.querySelector<HTMLButtonElement>('button[aria-label="Star Banana"]')!.click()
    await flushPromises()
    await wait(50)

    expect(document.body.querySelector('button[aria-label="Star Banana"]')).not.toBeNull()
    expect(document.body.querySelector('button[aria-label="Unstar Banana"]')).toBeNull()
  })
})
