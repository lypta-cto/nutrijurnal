import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { Food } from '~/composables/useEating'
import { changedTargets, targetsOf } from '~/composables/useEating'
import LibraryPage from '~/pages/library.vue'

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
    expect(page.text()).not.toContain('Your cookbook starts here')
  })

  it('shows the empty cookbook only when it really is empty', async () => {
    registerEndpoint('/api/v1/eating/recipes', () => [])
    registerEndpoint('/api/v1/eating/foods', () => [])

    const page = await mountSuspended(LibraryPage)
    await flushPromises()

    expect(page.text()).toContain('Your cookbook starts here')
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
