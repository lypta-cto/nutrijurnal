import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { Meal } from '~/composables/useEating'
import MealVoice from '~/components/MealVoice.vue'

const MEAL: Meal = {
  id: 'meal-voice',
  day: '2026-09-21',
  at: null,
  title: 'Lunch',
  slot: 'lunch',
  recipe_id: null,
  recipe_title: null,
  servings: 1,
  note: null,
  has_voice: true,
  voice_seconds: 4,
  voice_transcribed: false,
  items: [],
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0
}

function toastTitles(): string[] {
  return useState<{ title?: string }[]>('toasts').value.map(toast => toast.title ?? '')
}

function playFails(name: string) {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('refused', name))
}

beforeEach(() => {
  clearNuxtState(['toasts'])
  registerEndpoint('/api/v1/eating/meals/meal-voice/voice', () => new Blob(['voice'], { type: 'audio/webm' }))
  // Node's object URLs only take Node's own Blob, not the DOM one fetch hands back here
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice')
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function tapPlay() {
  const wrapper = await mountSuspended(MealVoice, { props: { meal: MEAL } })
  await wrapper.find('button[aria-label="Play the recording"]').trigger('click')
  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('playing a recording back', () => {
  it('says the device cannot play it — not that there is no connection', async () => {
    playFails('NotSupportedError')

    await tapPlay()

    expect(toastTitles()).toEqual(['This recording can’t be played on this device'])
  })

  it('asks for one more tap when iOS used the first one up on the download', async () => {
    playFails('NotAllowedError')

    await tapPlay()

    expect(toastTitles()).toEqual(['Ready — tap play again to listen'])
  })

  it('says there is no connection only when the recording could not be fetched', async () => {
    registerEndpoint('/api/v1/eating/meals/meal-voice/voice', () => {
      throw new TypeError('fetch failed')
    })
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play')

    await tapPlay()

    expect(play).not.toHaveBeenCalled()
    expect(toastTitles()).toHaveLength(1)
  })
})
