import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  clearNuxtState(['quick-add-open', 'quick-add-kind', 'quick-add-slot', 'quick-add-saved-at'])
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

function at(hour: number, minute = 0) {
  vi.setSystemTime(new Date(2026, 8, 21, hour, minute))
}

describe('the "+" sheet', () => {
  it('opens on the slot the clock suggests, with every way in', () => {
    at(13, 10)
    const quickAdd = useQuickAdd()

    quickAdd.open()

    expect(quickAdd.isOpen.value).toBe(true)
    expect(quickAdd.kind.value).toBeNull()
    expect(quickAdd.slot.value).toBe('lunch')
  })

  it('opens straight into one way, still on the clock’s slot', () => {
    at(7, 45)
    const quickAdd = useQuickAdd()

    quickAdd.open('scan')

    expect(quickAdd.kind.value).toBe('scan')
    expect(quickAdd.slot.value).toBe('breakfast')
  })

  it('goes into the slot a page asked for, whatever the time', () => {
    at(7, 45)
    const quickAdd = useQuickAdd()

    quickAdd.open(undefined, { slot: 'dinner' })

    expect(quickAdd.slot.value).toBe('dinner')
  })

  it('keeps the chosen slot while switching ways inside the open sheet', () => {
    at(13, 0)
    const quickAdd = useQuickAdd()
    quickAdd.open()
    quickAdd.slot.value = 'snack'

    at(16, 30) // a slow chooser: the clock has moved on to dinner hours
    quickAdd.open('voice')

    expect(quickAdd.kind.value).toBe('voice')
    expect(quickAdd.slot.value).toBe('snack')
  })

  it('asks the clock again the next time it opens fresh', () => {
    at(8, 0)
    const quickAdd = useQuickAdd()
    quickAdd.open()
    quickAdd.close()

    at(19, 30)
    quickAdd.open()

    expect(quickAdd.slot.value).toBe('dinner')
  })

  it('forgets the way it was opened in when it closes', () => {
    const quickAdd = useQuickAdd()
    quickAdd.open('quick')

    quickAdd.close()

    expect(quickAdd.isOpen.value).toBe(false)
    expect(quickAdd.kind.value).toBeNull()
  })

  it('is one sheet: every caller sees the same state', () => {
    const tabBar = useQuickAdd()
    const page = useQuickAdd()

    page.open('recipe', { slot: 'lunch' })

    expect(tabBar.isOpen.value).toBe(true)
    expect(tabBar.kind.value).toBe('recipe')
    expect(tabBar.slot.value).toBe('lunch')
  })

  it('tells the diary when something was written down through it', () => {
    vi.setSystemTime(new Date('2026-09-21T10:00:00Z'))
    const quickAdd = useQuickAdd()
    expect(quickAdd.savedAt.value).toBe(0)

    quickAdd.markSaved()

    expect(quickAdd.savedAt.value).toBe(Date.parse('2026-09-21T10:00:00Z'))
  })
})
