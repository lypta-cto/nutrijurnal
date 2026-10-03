import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserTimezone, isIos, isStandalone } from '~/composables/usePush'
import { REMINDER_PRESETS, SUGGESTED_REMINDERS, reminderIcon, reminderLabel } from '~/composables/useReminders'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('what a reminder is called', () => {
  it('is the meal’s slot, the water, or the summary', () => {
    expect(reminderLabel({ kind: 'meal', slot: 'breakfast' })).toBe('Breakfast')
    expect(reminderLabel({ kind: 'meal', slot: null })).toBe('Snack')
    expect(reminderLabel({ kind: 'water', slot: null })).toBe('Water')
    expect(reminderLabel({ kind: 'summary', slot: null })).toBe('Daily summary')
  })

  it('wears the same icon as its slot does everywhere else', () => {
    expect(reminderIcon({ kind: 'meal', slot: 'lunch' })).toBe('i-lucide-salad')
    expect(reminderIcon({ kind: 'meal', slot: null })).toBe('i-lucide-utensils')
    expect(reminderIcon({ kind: 'water', slot: null })).toBe('i-lucide-glass-water')
  })

  it('offers presets and suggestions the API will take', () => {
    for (const { payload } of REMINDER_PRESETS) {
      expect(payload.at).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
      expect(payload.kind === 'meal').toBe(Boolean(payload.slot))
    }
    for (const payload of SUGGESTED_REMINDERS) {
      expect(payload.at).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
    }
    expect(REMINDER_PRESETS.map(preset => preset.label)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Water', 'Daily summary'])
  })
})

describe('the device reminders are delivered to', () => {
  function device(userAgent: string, platform = '', maxTouchPoints = 0) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform)
    vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(maxTouchPoints)
  }

  it('knows an iPhone, and an iPad that says it is a Mac', () => {
    device('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
    expect(isIos()).toBe(true)

    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 'MacIntel', 5)
    expect(isIos()).toBe(true)
  })

  it('does not take a real Mac or an Android phone for one', () => {
    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 'MacIntel', 0)
    expect(isIos()).toBe(false)

    device('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36', 'Linux armv8l', 5)
    expect(isIos()).toBe(false)
  })

  it('knows when it runs as the installed app', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(display-mode: standalone)' }))
    expect(isStandalone()).toBe(true)

    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(isStandalone()).toBe(false)
  })

  it('sends the browser’s own timezone, or UTC when it cannot tell', () => {
    expect(browserTimezone()).toBe('Europe/Belgrade')

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('no ICU here')
    })
    expect(browserTimezone()).toBe('UTC')
  })
})
