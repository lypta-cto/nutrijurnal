import { describe, expect, it } from 'vitest'
import type { Food, MealItem, Recipe } from '~/composables/useEating'
import {
  UNITS,
  amountLabel,
  formatGrams,
  formatKcal,
  formatMacro,
  formatQuantity,
  gramsFor,
  itemPayload,
  macrosFromFood,
  macrosOf,
  perServing,
  scaleMacros,
  servingsLabel,
  splitTargets,
  statedGap,
  targetOf,
  targetsFromEstimate,
  targetsOf,
  unitItemsFor,
  unitLabel,
  unitsOf
} from '~/composables/useEating'
import { formatWater, formatWeight } from '~/composables/useBody'

const THIN = ' '

function food(fields: Partial<Food> = {}): Food {
  return {
    id: 'food-1',
    name: 'Ovsene pahuljice',
    name_en: 'Oats',
    brand: null,
    kcal: 379,
    protein: 13.2,
    carbs: 67.7,
    fat: 6.5,
    base_unit: 'g',
    units: { tbsp: 10 },
    barcode: null,
    source: 'seed',
    mine: false,
    archived: false,
    favourite: false,
    ...fields
  }
}

function item(fields: Partial<MealItem> = {}): MealItem {
  return {
    id: 'item-1',
    food_id: null,
    label: 'Kafa',
    quantity: 1,
    unit: 'serving',
    grams: 0,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ...fields
  }
}

function recipe(fields: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    title: 'Pasulj',
    subtitle: null,
    servings: 4,
    serving_unit: 'serving',
    minutes: null,
    steps: [],
    note: null,
    items: [],
    stated: null,
    kcal: 1600,
    protein: 80,
    carbs: 200,
    fat: 40,
    ...fields
  }
}

describe('how an amount reads', () => {
  it('names one of a unit in the singular and more in the plural', () => {
    expect(unitLabel('slice', 1)).toBe('slice')
    expect(unitLabel('slice', 2)).toBe('slices')
    expect(unitLabel('slice', 0.5)).toBe('slices')
    expect(unitLabel('serving', 3)).toBe('servings')
  })

  it('never pluralises a measure or an abbreviation', () => {
    expect(unitLabel('g', 250)).toBe('g')
    expect(unitLabel('ml', 500)).toBe('ml')
    expect(unitLabel('tbsp', 2)).toBe('tbsp')
    expect(unitLabel('tsp', 3)).toBe('tsp')
  })

  it('drops the noise after the second decimal and trailing zeros', () => {
    expect(formatQuantity(2)).toBe('2')
    expect(formatQuantity(1.5)).toBe('1.5')
    expect(formatQuantity(0.1 + 0.2)).toBe('0.3')
    expect(formatQuantity(1 / 3)).toBe('0.33')
  })

  it('puts the number and the unit together', () => {
    expect(amountLabel(50, 'g')).toBe('50 g')
    expect(amountLabel(1, 'scoop')).toBe('1 scoop')
    expect(amountLabel(2, 'piece')).toBe('2 pieces')
    expect(amountLabel(0.5, 'cup')).toBe('0.5 cups')
  })

  it('writes kcal as whole numbers split by a thin space, never a comma', () => {
    expect(formatKcal(2140)).toBe(`2${THIN}140`)
    expect(formatKcal(1234567.6)).toBe(`1${THIN}234${THIN}568`)
    expect(formatKcal(99.5)).toBe('100')
    expect(formatKcal(0)).toBe('0')
  })

  it('gives small macros a decimal and large ones none', () => {
    expect(formatMacro(8.44)).toBe('8.4')
    expect(formatMacro(0)).toBe('0.0')
    expect(formatMacro(10)).toBe('10')
    expect(formatMacro(126.6)).toBe('127')
    expect(formatGrams(120)).toBe('120 g')
    expect(formatGrams(2.5)).toBe('2.5 g')
  })

  it('reads water in millilitres until there is a litre to speak of', () => {
    expect(formatWater(250)).toBe('250 ml')
    expect(formatWater(1000)).toBe('1 l')
    expect(formatWater(1250)).toBe('1.25 l')
    expect(formatWater(2333)).toBe('2.33 l')
  })

  it('reads weight the way a scale shows it', () => {
    expect(formatWeight(72.44)).toBe('72.4 kg')
    expect(formatWeight(80)).toBe('80.0 kg')
  })
})

describe('the unit picker', () => {
  it('offers every unit but the server-only serving', () => {
    expect(UNITS).not.toContain('serving')
    expect(unitItemsFor('g').map(entry => entry.value)).toEqual(UNITS)
  })

  it('still shows a serving on a row that already holds one', () => {
    const items = unitItemsFor('serving')
    expect(items[0]).toEqual({ value: 'serving', label: 'serving' })
    expect(items).toHaveLength(UNITS.length + 1)
  })

  it('lists a food in its base unit first, then only the portions it names', () => {
    expect(unitsOf(food({ units: { tbsp: 10, piece: 40 } }))).toEqual(['g', 'piece', 'tbsp'])
    expect(unitsOf(food({ base_unit: 'ml', units: { cup: 240 } }))).toEqual(['ml', 'cup'])
    expect(unitsOf(food({ units: {} }))).toEqual(['g'])
  })
})

describe('grams and macros of a food', () => {
  it('counts grams and millilitres as they are', () => {
    expect(gramsFor(food(), 50, 'g')).toBe(50)
    expect(gramsFor(food({ base_unit: 'ml' }), 200, 'ml')).toBe(200)
  })

  it('weighs a named portion by the food’s own gram weight for it', () => {
    expect(gramsFor(food(), 3, 'tbsp')).toBe(30)
    expect(gramsFor(food({ units: { piece: 55 } }), 2, 'piece')).toBe(110)
  })

  it('has no answer for a portion the food does not name', () => {
    expect(gramsFor(food(), 1, 'scoop')).toBeNull()
  })

  it('scales the per-100 numbers to what is on the plate', () => {
    const plate = macrosFromFood(food(), 50)
    expect(plate.kcal).toBeCloseTo(189.5)
    expect(plate.protein).toBeCloseTo(6.6)
    expect(plate.carbs).toBeCloseTo(33.85)
    expect(plate.fat).toBeCloseTo(3.25)
  })

  it('adds a list up and treats a missing number as nothing', () => {
    const sum = macrosOf([
      { kcal: 100, protein: 10, carbs: 5, fat: 2 },
      { kcal: 50, protein: 1, carbs: 0, fat: 1 },
      { kcal: 20 } as never
    ])
    expect(sum).toEqual({ kcal: 170, protein: 11, carbs: 5, fat: 3 })
    expect(macrosOf([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('scales every macro by the same factor', () => {
    expect(scaleMacros({ kcal: 200, protein: 10, carbs: 20, fat: 8 }, 0.5)).toEqual({ kcal: 100, protein: 5, carbs: 10, fat: 4 })
  })
})

describe('a diary line written again', () => {
  it('sends a food line as its food and amount only — the server reweighs it', () => {
    const line = item({ food_id: 'food-1', label: 'Jaje', quantity: 2, unit: 'piece', kcal: 170, protein: 14 })
    expect(itemPayload(line)).toEqual({ food_id: 'food-1', label: 'Jaje', quantity: 2, unit: 'piece' })
  })

  it('carries a quick-kcal line’s numbers per serving, or the copy would count as nothing', () => {
    const line = item({ label: 'Burek', quantity: 2, unit: 'serving', kcal: 1400, protein: 40, carbs: 120, fat: 80 })
    expect(itemPayload(line)).toEqual({
      food_id: null,
      label: 'Burek',
      quantity: 2,
      unit: 'serving',
      macros: { kcal: 700, protein: 20, carbs: 60, fat: 40 }
    })
  })

  it('leaves out numbers it could not divide or that are all zero', () => {
    expect(itemPayload(item({ quantity: 0, kcal: 300 }))).not.toHaveProperty('macros')
    expect(itemPayload(item({ quantity: 1 }))).not.toHaveProperty('macros')
  })
})

describe('recipes', () => {
  it('says what the whole recipe makes', () => {
    expect(servingsLabel({ servings: 1, serving_unit: 'serving' })).toBe('1 serving')
    expect(servingsLabel({ servings: 4, serving_unit: 'serving' })).toBe('4 servings')
    expect(servingsLabel({ servings: 12, serving_unit: 'piece' })).toBe('12 pieces')
  })

  it('divides the dish into one serving', () => {
    expect(perServing(recipe())).toEqual({ kcal: 400, protein: 20, carbs: 50, fat: 10 })
    expect(perServing(recipe({ servings: 0 }))).toBeNull()
  })

  it('mentions a gap from the copied numbers only past a tenth', () => {
    const line = { id: 'line', food_id: 'f', label: 'Pasulj', quantity: 500, unit: 'g' as const, grams: 500, optional: false }
    const stated = { kcal: 1500, protein: 0, carbs: 0, fat: 0 }

    expect(statedGap(recipe({ items: [line], stated, kcal: 1600 }))).toBeNull()
    expect(statedGap(recipe({ items: [line], stated, kcal: 1800 }))).toBeCloseTo(0.2)
    expect(statedGap(recipe({ items: [line], stated, kcal: 1200 }))).toBeCloseTo(0.2)
    // Nothing to compare against: no stated numbers, or no ingredients
    expect(statedGap(recipe({ items: [line], stated: null }))).toBeNull()
    expect(statedGap(recipe({ items: [], stated, kcal: 0 }))).toBeNull()
  })
})

describe('daily targets', () => {
  it('splits a kcal target 30/40/30 into grams', () => {
    expect(splitTargets(2000)).toEqual({ target_kcal: 2000, target_protein: 150, target_carbs: 200, target_fat: 67 })
  })

  it('takes the calculator’s numbers as they are', () => {
    const estimate = {
      age: 30,
      bmr: 1320,
      maintenance: 1584,
      kcal: 1580,
      protein: 96,
      carbs: 180,
      fat: 53,
      daily_change: -4,
      protein_per_kg: 1.6,
      fat_percent: 30,
      floored: false
    }
    expect(targetsFromEstimate(estimate)).toEqual({ target_kcal: 1580, target_protein: 96, target_carbs: 180, target_fat: 53 })
  })

  it('is no target at all until one of them is set', () => {
    const none = { target_kcal: null, target_protein: null, target_carbs: null, target_fat: null }
    const settings = { ...none, onboarded_at: null, profile: null, water_goal_ml: 2000, water_glass_ml: 250, timezone: null, foods: 0, recipes: 0 }

    expect(targetOf(null)).toBeNull()
    expect(targetOf(settings)).toBeNull()
    expect(targetOf({ ...settings, target_kcal: 2100 })).toEqual({ kcal: 2100, protein: 0, carbs: 0, fat: 0 })
    expect(targetsOf(null)).toEqual(none)
    expect(targetsOf({ ...settings, target_fat: 70 })).toEqual({ ...none, target_fat: 70 })
  })
})
