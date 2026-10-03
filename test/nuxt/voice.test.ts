import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import type { Meal, MealPayload, ParseResult, Slot } from '~/composables/useEating'
import VoiceMeal from '~/components/VoiceMeal.vue'

const LANGUAGE_KEY = 'nutrijurnal-dictation-language'
const SENTENCE = 'dodaj 200 g piletine i pola banane i nešto slatko za ručak'

const PARSED: ParseResult = {
  items: [
    { food_id: 'chicken', label: 'Piletina', quantity: 200, unit: 'g', grams: 200, kcal: 330, protein: 62, carbs: 0, fat: 7.2 },
    { food_id: 'banana', label: 'Banana', quantity: 0.5, unit: 'piece', grams: 60, kcal: 53.4, protein: 0.7, carbs: 13.7, fat: 0.2 }
  ],
  unknown: ['nešto slatko'],
  slot: 'lunch'
}

function savedMeal(payload: MealPayload): Meal {
  return {
    id: 'meal-1',
    day: payload.day,
    at: null,
    title: 'Lunch',
    slot: payload.slot ?? 'snack',
    recipe_id: null,
    recipe_title: null,
    servings: 1,
    note: payload.note ?? null,
    has_voice: false,
    voice_seconds: null,
    voice_transcribed: false,
    items: [],
    kcal: 218,
    protein: 31.7,
    carbs: 13.7,
    fat: 3.8
  }
}

/** The parser and the diary, as the API answers them; what each was sent */
function api(parsed: ParseResult = PARSED) {
  const sent = { parse: [] as string[], meals: [] as MealPayload[] }
  registerEndpoint('/api/v1/eating/parse', {
    method: 'POST',
    handler: async (event) => {
      sent.parse.push((await readBody<{ text: string }>(event)).text)
      return parsed
    }
  })
  registerEndpoint('/api/v1/eating/meals', {
    method: 'POST',
    handler: async (event) => {
      const payload = await readBody<MealPayload>(event)
      sent.meals.push(payload)
      return savedMeal(payload)
    }
  })
  return sent
}

function button(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find(candidate => candidate.text().trim() === label || candidate.attributes('aria-label') === label)
  if (!found) {
    throw new Error(`No "${label}" button among: ${wrapper.findAll('button').map(candidate => candidate.text().trim()).join(' | ')}`)
  }
  return found
}

async function typed(sentence = SENTENCE, mealSlot: Slot = 'snack') {
  const voice = await mountSuspended(VoiceMeal, { props: { day: '2026-09-21', mealSlot } })
  await button(voice, 'Type it instead').trigger('click')
  await voice.find('textarea').setValue(sentence)
  await button(voice, 'Read it again').trigger('click')
  return voice
}

function chosenSlot(voice: VueWrapper) {
  return voice.find('[role="radiogroup"][aria-label="Meal"] [aria-checked="true"]').text()
}

beforeEach(() => {
  clearNuxtState(['dictation-language'])
  localStorage.removeItem(LANGUAGE_KEY)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the dictation language', () => {
  function speaking(language: string) {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(language)
  }

  it('listens in Serbian for anyone whose browser speaks a Serbo-Croatian language', () => {
    for (const language of ['sr-Latn-RS', 'sr', 'hr-HR', 'bs-BA', 'cnr']) {
      clearNuxtState(['dictation-language'])
      speaking(language)
      expect(useDictationLanguage().value, language).toBe('sr-RS')
    }
  })

  it('listens in English for everyone else', () => {
    for (const language of ['en-GB', 'de-DE', 'srb']) {
      clearNuxtState(['dictation-language'])
      speaking(language)
      expect(useDictationLanguage().value, language).toBe('en-US')
    }
  })

  it('remembers the speaker’s own choice on this device', async () => {
    speaking('en-GB')
    useDictationLanguage().value = 'sr-RS'
    await nextTick()
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('sr-RS')

    clearNuxtState(['dictation-language'])
    expect(useDictationLanguage().value).toBe('sr-RS')
  })

  it('ignores a remembered value it does not know', () => {
    speaking('en-GB')
    localStorage.setItem(LANGUAGE_KEY, 'tlh-KX')

    expect(useDictationLanguage().value).toBe('en-US')
  })
})

describe('a meal said out loud', () => {
  it('offers typing where the browser cannot record', async () => {
    // happy-dom has no MediaRecorder, like an old iPhone or a locked-down browser
    const voice = await mountSuspended(VoiceMeal, { props: { day: '2026-09-21', mealSlot: 'snack' } })

    expect(button(voice, 'Start recording').attributes('disabled')).toBeDefined()
    expect(voice.text()).toContain('This browser can\'t record audio. Type what you ate instead.')
  })

  it('reads the words into a draft and takes the meal the sentence named', async () => {
    const sent = api()

    const voice = await typed()

    await vi.waitFor(() => expect(voice.text()).toContain('Piletina'))
    expect(sent.parse).toEqual([SENTENCE])
    expect(chosenSlot(voice)).toBe('Lunch')
    expect(voice.text()).toContain('383 kcal')
    expect(voice.text()).toContain('Not recognised')
    expect(voice.text()).toContain('nešto slatko')
  })

  it('stays on the sheet’s meal when the sentence names none', async () => {
    api({ ...PARSED, slot: null })

    const voice = await typed('200 g piletine', 'dinner')

    await vi.waitFor(() => expect(voice.text()).toContain('Piletina'))
    expect(chosenSlot(voice)).toBe('Dinner')
  })

  it('scales a line’s numbers with its amount', async () => {
    api()
    const voice = await typed()
    await vi.waitFor(() => expect(voice.text()).toContain('Piletina'))

    await voice.find('input[aria-label="Amount of Piletina"]').setValue(100)

    // 165 for the chicken now, 53.4 for the half banana
    expect(voice.text()).toContain('218 kcal')
  })

  it('saves exactly the draft that was looked at — edited amounts, kept words, the named meal', async () => {
    const sent = api()
    const voice = await typed()
    await vi.waitFor(() => expect(voice.text()).toContain('Piletina'))
    await voice.find('input[aria-label="Amount of Piletina"]').setValue(150)
    await button(voice, 'Remove Banana').trigger('click')
    await button(voice, 'Keep as written').trigger('click')
    expect(voice.text()).not.toContain('Not recognised')

    await button(voice, 'Add to Lunch').trigger('click')

    await vi.waitFor(() => expect(sent.meals).toHaveLength(1))
    expect(sent.meals[0]).toEqual({
      day: '2026-09-21',
      slot: 'lunch',
      note: SENTENCE,
      items: [
        { food_id: 'chicken', label: 'Piletina', quantity: 150, unit: 'g' },
        { food_id: null, label: 'nešto slatko', quantity: 1, unit: 'piece' }
      ]
    })
    await vi.waitFor(() => expect(voice.emitted('saved')).toHaveLength(1))
  })

  it('saved while the words are still being read, waits for the foods in them', async () => {
    const sent = api()
    // The parser answers slowly, the way a phone on a train does
    registerEndpoint('/api/v1/eating/parse', {
      method: 'POST',
      handler: async () => {
        await new Promise(resolve => setTimeout(resolve, 60))
        return PARSED
      }
    })
    const voice = await mountSuspended(VoiceMeal, { props: { day: '2026-09-21', mealSlot: 'snack' } })
    await button(voice, 'Type it instead').trigger('click')
    await voice.find('textarea').setValue(SENTENCE)
    await button(voice, 'Read it again').trigger('click')

    // Tapped before the draft arrived
    await button(voice, 'Save for later').trigger('click')

    await vi.waitFor(() => expect(sent.meals).toHaveLength(1))
    expect(sent.meals[0]?.items.map(item => item.label)).toEqual(['Piletina', 'Banana'])
    expect(sent.meals[0]?.slot).toBe('lunch')
  })

  it('keeps the words for later when nothing in them was recognised', async () => {
    const sent = api({ items: [], unknown: [], slot: null })
    const voice = await typed('ono od juče')
    await vi.waitFor(() => expect(voice.text()).toContain('Save for later'))

    await button(voice, 'Save for later').trigger('click')

    await vi.waitFor(() => expect(sent.meals).toHaveLength(1))
    expect(sent.meals[0]).toMatchObject({ slot: 'snack', note: 'ono od juče', items: [] })
  })
})
