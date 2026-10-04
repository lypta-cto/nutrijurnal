import { describe, expect, it } from 'vitest'
import { dayInSentence, presetRange } from '~/composables/useEating'
import { importSummary } from '~/composables/useImport'

describe('export periods, named after the calendar', () => {
  // Saturday 3 October 2026
  const today = '2026-10-03'

  it('today is just today', () => {
    expect(presetRange('today', today)).toEqual({ from: today, to: today })
  })

  it('this week runs from Monday to today, never into days to come', () => {
    expect(presetRange('this-week', today)).toEqual({ from: '2026-09-28', to: today })
  })

  it('last week is the whole Monday-to-Sunday before it', () => {
    expect(presetRange('last-week', today)).toEqual({ from: '2026-09-21', to: '2026-09-27' })
  })

  it('a Monday is the first day of its own week, and a Sunday the last', () => {
    expect(presetRange('this-week', '2026-09-28')).toEqual({ from: '2026-09-28', to: '2026-09-28' })
    expect(presetRange('this-week', '2026-10-04')).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(presetRange('last-week', '2026-09-28')).toEqual({ from: '2026-09-21', to: '2026-09-27' })
  })

  it('this month starts on the first, across a year end too', () => {
    expect(presetRange('this-month', today)).toEqual({ from: '2026-10-01', to: today })
    expect(presetRange('last-week', '2027-01-02')).toEqual({ from: '2026-12-21', to: '2026-12-27' })
  })
})

describe('what an import did, in one line', () => {
  const none = { foods: 0, recipes: 0, meals: 0, water: 0, weight: 0, skipped: 0, warnings: [] }

  it('names what was added, plural or not', () => {
    expect(importSummary({ ...none, meals: 37, recipes: 82, foods: 1 })).toBe('Added 37 meals, 82 recipes and 1 food')
    expect(importSummary({ ...none, meals: 1 })).toBe('Added 1 meal')
  })

  it('says what was already there', () => {
    expect(importSummary({ ...none, meals: 2, skipped: 35 })).toBe('Added 2 meals · 35 already here')
    expect(importSummary({ ...none, skipped: 37 })).toBe('Nothing new — 37 already here')
    expect(importSummary(none)).toBe('Nothing to add in that file')
  })
})

describe('a day in the middle of a sentence', () => {
  const today = '2026-10-04'

  it('keeps today, yesterday and tomorrow lowercase', () => {
    expect(dayInSentence('2026-10-04', today)).toBe('today')
    expect(dayInSentence('2026-10-03', today)).toBe('yesterday')
    expect(dayInSentence('2026-10-05', today)).toBe('tomorrow')
  })

  it('names any other day by its date, with "on" only when asked', () => {
    expect(dayInSentence('2026-10-01', today)).toBe('Thu 1 Oct')
    expect(dayInSentence('2026-10-01', today, { on: true })).toBe('on Thu 1 Oct')
    expect(dayInSentence('2026-10-03', today, { on: true })).toBe('yesterday')
  })
})
