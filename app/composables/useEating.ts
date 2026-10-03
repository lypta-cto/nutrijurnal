/** Every way an amount can be written down — grams and millilitres are the
 * base, the rest are named portions a food carries its own gram weight for.
 * `serving` only ever comes from the server: a plate known by its numbers
 * alone (quick kcal, or a recipe with no ingredients) is counted in servings. */
export type Unit = 'g' | 'ml' | 'piece' | 'scoop' | 'tbsp' | 'tsp' | 'cup' | 'handful' | 'pinch' | 'slice' | 'serving'

/** Where a meal sits in the day — the diary is grouped by these four */
export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const SLOTS: { value: Slot, label: string, plural: string, icon: string }[] = [
  { value: 'breakfast', label: 'Breakfast', plural: 'Breakfast', icon: 'i-lucide-coffee' },
  { value: 'lunch', label: 'Lunch', plural: 'Lunch', icon: 'i-lucide-salad' },
  { value: 'dinner', label: 'Dinner', plural: 'Dinner', icon: 'i-lucide-utensils' },
  { value: 'snack', label: 'Snack', plural: 'Snacks', icon: 'i-lucide-apple' }
]

export function slotLabel(slot: Slot): string {
  return SLOTS.find(entry => entry.value === slot)?.label ?? 'Snack'
}

/** The slot the clock suggests — the same hours the API uses for a timed meal */
export function slotForNow(date = new Date()): Slot {
  const hour = date.getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

/** "08:30" in the viewer's own clock — what a meal written down now is timed at */
export function clockNow(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Food extends Macros {
  id: string
  name: string
  name_en: string | null
  brand: string | null
  /** kcal/protein/carbs/fat are per 100 g or 100 ml */
  base_unit: 'g' | 'ml'
  /** grams per named unit — "1 scoop = 30" */
  units: Partial<Record<Unit, number>>
  barcode: string | null
  source: 'seed' | 'manual' | 'barcode'
  /** Your own food; the shared staples are read-only */
  mine: boolean
  archived: boolean
  /** Starred, so it comes first when adding food */
  favourite: boolean
}

/** A food offered for a quick add, with the amount it was last eaten in */
export interface FoodPick extends Food {
  last_quantity: number | null
  last_unit: Unit | null
  last_day: string | null
}

export interface QuickFoods {
  favourites: FoodPick[]
  recent: FoodPick[]
}

export interface MealItem extends Macros {
  id: string
  food_id: string | null
  label: string
  quantity: number
  unit: Unit
  grams: number
}

export interface Meal extends Macros {
  id: string
  /** YYYY-MM-DD */
  day: string
  /** "08:30", or null when the time wasn't worth writing down */
  at: string | null
  title: string
  slot: Slot
  recipe_id: string | null
  recipe_title: string | null
  servings: number
  note: string | null
  /** Said out loud rather than typed: the recording is kept either way */
  has_voice: boolean
  voice_seconds: number | null
  /** The note's words came from the browser's dictation, unchecked */
  voice_transcribed: boolean
  items: MealItem[]
}

export interface RecipeItem {
  id: string
  food_id: string | null
  label: string
  quantity: number
  unit: Unit
  grams: number
  optional: boolean
}

export interface Recipe extends Macros {
  id: string
  title: string
  subtitle: string | null
  servings: number
  serving_unit: 'serving' | 'piece'
  minutes: number | null
  steps: string[]
  note: string | null
  items: RecipeItem[]
  /** Numbers copied off a label or a plan, for the whole dish */
  stated: Macros | null
}

export interface DayTotals extends Macros {
  day: string
  meals: number
}

export interface EatingSettings extends Targets {
  /** When the first-run questions were answered or skipped */
  onboarded_at: string | null
  /** The calculator's answers, once they were given */
  profile: GoalProfile | null
  /** The shared pantry plus your own foods */
  foods: number
  recipes: number
}

/** The four daily targets; null leaves one unmeasured */
export interface Targets {
  target_kcal: number | null
  target_protein: number | null
  target_carbs: number | null
  target_fat: number | null
}

export interface SettingsPatch extends Partial<Targets> {
  /** Marks the first-run questions as done; never unset */
  onboarded?: boolean
  /** The answers the targets were worked out from, kept whole */
  profile?: GoalProfile
}

export type Sex = 'female' | 'male' | 'other'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Goal = 'lose' | 'maintain' | 'gain'

/** What the goal calculator asks */
export interface GoalProfile {
  sex: Sex
  birth_year: number
  height_cm: number
  weight_kg: number
  activity: Activity
  goal: Goal
  /** Kilograms a week; ignored while maintaining */
  pace: number
  /** Null takes the goal's own default */
  protein_per_kg: number | null
  fat_percent: number
}

/** What the calculator answers — an estimate to adjust, never a prescription */
export interface GoalEstimate {
  age: number
  /** Burned at rest */
  bmr: number
  /** Burned on an ordinary day of this activity */
  maintenance: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** Negative is a deficit */
  daily_change: number
  protein_per_kg: number
  fat_percent: number
  /** The goal asked for less than the safe minimum and was raised to it */
  floored: boolean
}

export function targetsFromEstimate(estimate: GoalEstimate): Targets {
  return {
    target_kcal: estimate.kcal,
    target_protein: estimate.protein,
    target_carbs: estimate.carbs,
    target_fat: estimate.fat
  }
}

/** A sensible starting split of a kcal target: 30 % protein, 40 % carbs,
 *  30 % fat — a starting point to adjust, not advice */
export function splitTargets(kcal: number): Targets {
  return {
    target_kcal: Math.round(kcal),
    target_protein: Math.round((kcal * 0.3) / 4),
    target_carbs: Math.round((kcal * 0.4) / 4),
    target_fat: Math.round((kcal * 0.3) / 9)
  }
}

export function targetsOf(settings: EatingSettings | null): Targets {
  return {
    target_kcal: settings?.target_kcal ?? null,
    target_protein: settings?.target_protein ?? null,
    target_carbs: settings?.target_carbs ?? null,
    target_fat: settings?.target_fat ?? null
  }
}

export interface DayView {
  day: string
  totals: Macros
  target: Macros | null
  meals: Meal[]
}

export interface ParsedItem extends Macros {
  food_id: string | null
  label: string
  quantity: number
  unit: Unit
  grams: number
}

export interface ParseResult {
  items: ParsedItem[]
  /** Chunks the parser could not resolve — shown so they can be fixed by hand */
  unknown: string[]
}

/** The ways into a meal, as the meal form's tabs — the quick-add sheet opens on one */
export type MealTab = 'search' | 'type' | 'recipe' | 'scan' | 'kcal'

export interface ScanResult {
  found: boolean
  barcode: string | null
  food: Food | null
  message: string | null
}

export interface MealItemPayload {
  food_id?: string | null
  label: string
  quantity: number
  unit: Unit
  /** Numbers for one serving of a plate with no food behind it */
  macros?: Macros
}

export interface MealPayload {
  day: string
  at?: string | null
  /** Left out: the one food's name, or the slot's */
  title?: string
  /** Left out: taken from the time, then from the title */
  slot?: Slot
  note?: string | null
  items: MealItemPayload[]
}

export interface FoodPayload {
  name: string
  brand?: string | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  base_unit?: 'g' | 'ml'
  units?: Partial<Record<Unit, number>>
  barcode?: string | null
  archived?: boolean
}

export interface RecipeItemPayload {
  food_id?: string | null
  label: string
  quantity: number
  unit: Unit
  optional?: boolean
}

export interface RecipePayload {
  title?: string
  /** Numbers copied off a label or a plan, for a dish known by them alone */
  stated?: Macros | null
  subtitle?: string | null
  minutes?: number | null
  servings?: number
  serving_unit?: 'serving' | 'piece'
  steps?: string[]
  note?: string | null
  items?: RecipeItemPayload[]
}

/**
 * A dish as it is written on a label or in a meal plan, pasted whole:
 *
 *   Overnight oats with banana
 *   Kcal: 420, P: 18g, C: 65g, F: 9g
 *
 * The first line is the name, a line of numbers is what was printed, and
 * anything else is treated as ingredients for the parser. Serbian and English
 * labels both read (`UH`/`C`/`carbs`, `M`/`F`/`fat`), because Serbian labels
 * and half the internet disagree on the words.
 */
export interface PastedDish {
  title: string
  stated: Macros | null
  /** Lines that were neither the title nor the numbers */
  rest: string
}

const MACRO_LINE = /(kcal|kalorij)/i
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`

function figure(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const match = text.match(new RegExp(String.raw`(?:^|[^a-zA-Zčćžšđ])${label}\s*[:=]?\s*${NUMBER}`, 'i'))
      ?? text.match(new RegExp(`${NUMBER}\\s*(?:g\\s*)?${label}`, 'i'))
    if (match?.[1]) {
      return Number(match[1].replace(',', '.'))
    }
  }
  return null
}

export function readPastedDish(text: string): PastedDish {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const numbersAt = lines.findIndex(line => MACRO_LINE.test(line) && /\d/.test(line))

  let stated: Macros | null = null
  if (numbersAt !== -1) {
    const line = lines[numbersAt] ?? ''
    const kcal = figure(line, ['kcal', 'kalorija', 'kalorije'])
    if (kcal !== null) {
      stated = {
        kcal,
        protein: figure(line, ['protein', 'proteini', 'p']) ?? 0,
        carbs: figure(line, ['uh', 'ugljeni hidrati', 'carbs', 'c']) ?? 0,
        fat: figure(line, ['masti', 'mast', 'fat', 'm', 'f']) ?? 0
      }
    }
  }

  const title = lines.find((_, index) => index !== numbersAt) ?? ''
  const rest = lines
    .filter((line, index) => index !== numbersAt && line !== title)
    .join('\n')

  return { title: title.slice(0, 160), stated, rest }
}

/** Every unit a picker offers, in that order. `serving` is not one of them:
 * it is how the server counts a plate that has no food behind it. */
export const UNITS: Unit[] = ['g', 'ml', 'piece', 'scoop', 'tbsp', 'tsp', 'cup', 'handful', 'pinch', 'slice']

/** What a batch divides into: a pot feeds four, a tray yields twelve */
export const SERVING_UNITS: { value: 'serving' | 'piece', label: string, hint: string }[] = [
  { value: 'serving', label: 'Servings', hint: 'One dish shared out — a pot that feeds four' },
  { value: 'piece', label: 'Pieces', hint: 'A batch of countable things — twelve muffins' }
]

const UNIT_ONE: Record<Unit, string> = {
  g: 'g',
  ml: 'ml',
  piece: 'piece',
  scoop: 'scoop',
  tbsp: 'tbsp',
  tsp: 'tsp',
  cup: 'cup',
  handful: 'handful',
  pinch: 'pinch',
  slice: 'slice',
  serving: 'serving'
}

const UNIT_MANY: Partial<Record<Unit, string>> = {
  piece: 'pieces',
  scoop: 'scoops',
  cup: 'cups',
  handful: 'handfuls',
  pinch: 'pinches',
  slice: 'slices',
  serving: 'servings'
}

/** How a unit reads next to a number — "50 g", "1 scoop", "2 slices" */
export function unitLabel(unit: Unit, quantity = 1): string {
  return quantity === 1 ? UNIT_ONE[unit] : (UNIT_MANY[unit] ?? UNIT_ONE[unit])
}

/** The unit picker's items, with plain-English labels */
export const UNIT_ITEMS: { value: Unit, label: string }[] = UNITS.map(unit => ({ value: unit, label: UNIT_ONE[unit] }))

/** The picker for a row that may already hold a unit the picker doesn't
 *  offer (a serving), so the select never shows up blank */
export function unitItemsFor(unit: Unit): { value: Unit, label: string }[] {
  return UNITS.includes(unit) ? UNIT_ITEMS : [{ value: unit, label: UNIT_ONE[unit] }, ...UNIT_ITEMS]
}

/** 1.5 → "1.5", 2.0 → "2" — an amount nobody has to read past */
export function formatQuantity(quantity: number): string {
  return String(Number(quantity.toFixed(2)))
}

/** "50 g", "1 scoop" */
export function amountLabel(quantity: number, unit: Unit): string {
  return `${formatQuantity(quantity)} ${unitLabel(unit, quantity)}`
}

// Money-style numbers: thin space between thousands, never a comma
const THIN_SPACE = ' '

/** kcal are whole numbers — "2 140" */
export function formatKcal(value: number): string {
  return Math.round(value).toLocaleString('en-GB').replace(/,/g, THIN_SPACE)
}

/** Macros carry one decimal only while they're small — "8.4", "126" */
export function formatMacro(value: number): string {
  return Math.abs(value) < 10 ? value.toFixed(1) : String(Math.round(value))
}

/** Weights read as "120 g", whatever the food is measured in */
export function formatGrams(grams: number): string {
  return `${formatMacro(grams)} g`
}

export function emptyMacros(): Macros {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0 }
}

/** What a list of items adds up to */
export function macrosOf(items: Macros[]): Macros {
  return items.reduce<Macros>((sum, item) => ({
    kcal: sum.kcal + (item.kcal ?? 0),
    protein: sum.protein + (item.protein ?? 0),
    carbs: sum.carbs + (item.carbs ?? 0),
    fat: sum.fat + (item.fat ?? 0)
  }), emptyMacros())
}

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    kcal: macros.kcal * factor,
    protein: macros.protein * factor,
    carbs: macros.carbs * factor,
    fat: macros.fat * factor
  }
}

/** What an amount of a food weighs, or null when the food has no such portion */
export function gramsFor(food: Food, quantity: number, unit: Unit): number | null {
  if (unit === food.base_unit || unit === 'g' || unit === 'ml') {
    return quantity
  }
  const perUnit = food.units[unit]
  return perUnit === undefined ? null : quantity * perUnit
}

/** The food's own numbers are per 100 — this is what the plate actually holds */
export function macrosFromFood(food: Food, grams: number): Macros {
  return scaleMacros({ kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat }, grams / 100)
}

/** The units a food can be measured in: its base, plus the portions it names */
export function unitsOf(food: Food): Unit[] {
  const named = UNITS.filter(unit => food.units[unit] !== undefined && unit !== 'g' && unit !== 'ml')
  return [food.base_unit, ...named]
}

/**
 * A diary line as it would be written again — onto another day, or into a
 * copy of the meal. A line with no food behind it still carries numbers (a
 * quick kcal entry, a recipe known by its label): those travel as the
 * per-serving `macros`, or the copy would quietly count as nothing.
 */
export function itemPayload(item: MealItem): MealItemPayload {
  const direct = !item.food_id && item.quantity > 0 && (item.kcal || item.protein || item.carbs || item.fat)
  return {
    food_id: item.food_id,
    label: item.label,
    quantity: item.quantity,
    unit: item.unit,
    ...(direct ? { macros: scaleMacros(item, 1 / item.quantity) } : {})
  }
}

/** "08:30", and a dash for a meal nobody timed */
export function timeLabel(at: string | null): string {
  return at ? at.slice(0, 5) : '—'
}

/** A day, moved by whole days, in the viewer's own timezone */
export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00`)
  date.setDate(date.getDate() + delta)
  return localIsoDay(date)
}

/** "Today", "Yesterday", "Fri 19 Sep" */
export function dayLabel(day: string): string {
  const today = localIsoDay()
  if (day === today) {
    return 'Today'
  }
  if (day === shiftDay(today, -1)) {
    return 'Yesterday'
  }
  if (day === shiftDay(today, 1)) {
    return 'Tomorrow'
  }
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "12 Sep" — a day is never shown as the ISO string it arrived as */
export function dayShort(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** The three bars under the kcal headline — one colour per macro, everywhere */
export const MACRO_BARS: { key: 'protein' | 'carbs' | 'fat', label: string, letter: string, bar: string, text: string, dot: string }[] = [
  { key: 'protein', label: 'Protein', letter: 'P', bar: 'bg-sky-500', text: 'text-sky-500', dot: 'bg-sky-500' },
  { key: 'carbs', label: 'Carbs', letter: 'C', bar: 'bg-violet-500', text: 'text-violet-500', dot: 'bg-violet-500' },
  { key: 'fat', label: 'Fat', letter: 'F', bar: 'bg-amber-500', text: 'text-amber-500', dot: 'bg-amber-500' }
]

/**
 * The grids the diary is read on — phone-width, always: the app is one
 * column even on a desktop, so the macros sit on a line under each name
 * rather than in columns of their own.
 *
 * Written out in full on purpose: Tailwind reads these class names out of the
 * source, so an arbitrary value stitched together at runtime never exists.
 */

/** time · meal · state pill · ⋮ · chevron */
export const MEAL_COLUMNS = 'grid items-center gap-x-2 grid-cols-[3.25rem_minmax(0,1fr)_4.25rem_1.75rem_1.75rem]'

/** amount · unit · name · ✕ */
export const ITEM_COLUMNS = 'grid items-center gap-x-2 grid-cols-[3.25rem_4.5rem_minmax(0,1fr)_1.75rem]'

/**
 * The drafted-items table inside the meal form: amount, unit and name on the
 * line, the macros right under them in a fixed grid of their own.
 */
export const DRAFT_COLUMNS = 'grid items-center gap-x-2 grid-cols-[3.5rem_4.5rem_minmax(0,1fr)_1.75rem]'

/** The macro strip under a drafted row, and the heading that sits over it */
export const DRAFT_MACRO_COLUMNS = 'grid gap-x-2 grid-cols-[2.75rem_2.75rem_2.75rem_4rem] text-right tabular-nums'

/** "4 servings", "12 pieces" — what the whole recipe makes */
export function servingsLabel(recipe: Pick<Recipe, 'servings' | 'serving_unit'>): string {
  const noun = recipe.serving_unit === 'piece' ? 'piece' : 'serving'
  return `${recipe.servings} ${recipe.servings === 1 ? noun : `${noun}s`}`
}

/** What one serving of a recipe is worth, or null when it makes none */
export function perServing(recipe: Recipe): Macros | null {
  if (recipe.servings <= 0) {
    return null
  }
  return scaleMacros({ kcal: recipe.kcal, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat }, 1 / recipe.servings)
}

/**
 * How far the ingredients land from the numbers that were copied in. Worth
 * a word only past a tenth — under that it is rounding, not a difference.
 */
export function statedGap(recipe: Recipe): number | null {
  const stated = recipe.stated
  if (!stated || !stated.kcal || !recipe.items.length) {
    return null
  }
  const gap = Math.abs(recipe.kcal - stated.kcal) / stated.kcal
  return gap > 0.1 ? gap : null
}

/** The targets as one object, or null while none are set */
export function targetOf(settings: EatingSettings | null): Macros | null {
  if (!settings) {
    return null
  }
  const { target_kcal: kcal, target_protein: protein, target_carbs: carbs, target_fat: fat } = settings
  if (kcal === null && protein === null && carbs === null && fat === null) {
    return null
  }
  return { kcal: kcal ?? 0, protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 }
}

/**
 * The diary: one day at a time, meals made of items, plus the recipes and the
 * pantry (foods) they are written from.
 *
 * Everything here is the signed-in person's own. The day's meals and the week
 * strip live in shared state so the page, the quick-add sheet and the forms
 * agree without passing everything down.
 */
export function useEating() {
  const api = useApi()

  const settings = useState<EatingSettings | null>('eating-settings', () => null)
  const day = useState<string>('eating-day', () => localIsoDay())
  const dayView = useState<DayView | null>('eating-day-view', () => null)
  const week = useState<DayTotals[]>('eating-week', () => [])
  const loading = ref(false)

  const meals = computed<Meal[]>(() => dayView.value?.meals ?? [])
  const totals = computed<Macros>(() => dayView.value?.totals ?? emptyMacros())
  /** The day's own target wins; the settings are the fallback before it loads */
  const target = computed<Macros | null>(() => dayView.value?.target ?? targetOf(settings.value))

  // --- Settings -------------------------------------------------------------

  async function loadSettings() {
    settings.value = await api.get<EatingSettings>('/eating/settings')
    return settings.value
  }

  async function saveSettings(patch: SettingsPatch) {
    settings.value = await api.patch<EatingSettings>('/eating/settings', { ...patch })
    return settings.value
  }

  /** What a day should come to for these answers — nothing is saved */
  async function estimateGoals(profile: GoalProfile) {
    return api.post<GoalEstimate>('/eating/goals/estimate', { ...profile })
  }

  // --- Days -----------------------------------------------------------------

  async function loadDay(which = day.value) {
    loading.value = true
    try {
      const view = await api.get<DayView>(`/eating/days/${which}`)
      // A slow answer for a day already left behind must not replace the one on screen
      if (which === day.value) {
        dayView.value = view
      }
      return view
    } finally {
      loading.value = false
    }
  }

  /** Another day's meals, read without moving the diary there */
  async function peekDay(which: string) {
    return api.get<DayView>(`/eating/days/${which}`)
  }

  async function loadDays(from: string, to: string) {
    return api.get<DayTotals[]>('/eating/days', { query: { from, to } })
  }

  /** The calendar week the day sits in, Monday first — the way a week is
   * read on a plan, not a rolling seven days that shifts under you */
  function weekStart(which: string): string {
    const date = new Date(`${which}T12:00:00`)
    // getDay(): 0 is Sunday, so Sunday walks back six days, not none
    const back = (date.getDay() + 6) % 7
    return shiftDay(which, -back)
  }

  /** Every day from `from` to `to`, the empty ones included */
  async function loadRange(from: string, to: string): Promise<DayTotals[]> {
    // A range that fails to load reads as empty days, not as a broken page
    const known = await loadDays(from, to).catch((): DayTotals[] => [])
    const byDay = new Map(known.map(entry => [entry.day, entry]))
    const out: DayTotals[] = []
    for (let current = from; current <= to; current = shiftDay(current, 1)) {
      out.push(byDay.get(current) ?? { day: current, meals: 0, ...emptyMacros() })
    }
    return out
  }

  /** The seven days of the week the anchor sits in */
  async function loadWeek(anchor = day.value) {
    const from = weekStart(anchor)
    week.value = await loadRange(from, shiftDay(from, 6))
    return week.value
  }

  /** Put a meal back where it belongs — the day's list, in time order */
  function put(meal: Meal) {
    if (!dayView.value || meal.day !== dayView.value.day) {
      return meal
    }
    const list = dayView.value.meals.some(row => row.id === meal.id)
      ? dayView.value.meals.map(row => (row.id === meal.id ? meal : row))
      : [...dayView.value.meals, meal]
    dayView.value = {
      ...dayView.value,
      meals: sortMeals(list),
      totals: macrosOf(list)
    }
    return meal
  }

  function drop(id: string) {
    if (!dayView.value) {
      return
    }
    const list = dayView.value.meals.filter(row => row.id !== id)
    dayView.value = { ...dayView.value, meals: list, totals: macrosOf(list) }
  }

  // --- Meals ----------------------------------------------------------------

  async function addMeal(payload: MealPayload) {
    return put(await api.post<Meal>('/eating/meals', { ...payload }))
  }

  async function updateMeal(id: string, patch: Partial<Pick<Meal, 'day' | 'at' | 'title' | 'note' | 'slot'>>) {
    const updated = await api.patch<Meal>(`/eating/meals/${id}`, { ...patch })
    // Moved to another day: it leaves this one
    if (dayView.value && updated.day !== dayView.value.day) {
      drop(id)
      return updated
    }
    return put(updated)
  }

  async function removeMeal(id: string) {
    await api.del(`/eating/meals/${id}`)
    drop(id)
  }

  async function addItem(mealId: string, payload: MealItemPayload) {
    return put(await api.post<Meal>(`/eating/meals/${mealId}/items`, { ...payload }))
  }

  async function updateItem(mealId: string, itemId: string, patch: Partial<MealItemPayload>) {
    return put(await api.patch<Meal>(`/eating/meals/${mealId}/items/${itemId}`, { ...patch }))
  }

  async function removeItem(mealId: string, itemId: string) {
    return put(await api.del<Meal>(`/eating/meals/${mealId}/items/${itemId}`))
  }

  /** The recording onto a meal. The words, if the browser caught any, are the
   *  meal's note — this is only the audio. */
  async function attachVoice(
    mealId: string,
    take: { blob: Blob, seconds: number, transcribed: boolean }
  ) {
    const form = new FormData()
    // The extension only has to match the type; the server reads the type
    const suffix = take.blob.type.includes('mp4') ? 'm4a' : 'webm'
    form.append('file', take.blob, `voice.${suffix}`)
    form.append('seconds', String(Math.round(take.seconds * 10) / 10))
    form.append('transcribed', String(take.transcribed))
    return put(await api.post<Meal>(`/eating/meals/${mealId}/voice`, form))
  }

  /** The audio itself, for playing back. The endpoint needs the bearer token,
   *  so it cannot be an <audio src> — it arrives as a blob and is played from
   *  an object URL. */
  async function loadVoice(mealId: string) {
    return api.get<Blob>(`/eating/meals/${mealId}/voice`)
  }

  /** Once it is written down properly, the recording has done its job */
  async function dropVoice(mealId: string) {
    return put(await api.del<Meal>(`/eating/meals/${mealId}/voice`))
  }

  /** Free text in, resolved items out — "50g oats, 1 scoop whey, 1 banana" */
  async function parseText(text: string) {
    return api.post<ParseResult>('/eating/parse', { text })
  }

  /** A recipe copied onto a day, scaled by servings; the copy is then ours to edit */
  async function mealFromRecipe(payload: { recipe_id: string, day: string, at?: string | null, slot?: Slot, servings: number }) {
    return put(await api.post<Meal>('/eating/meals/from-recipe', { ...payload }))
  }

  /** The same plate again — the copy keeps the numbers it was eaten at */
  async function copyMeal(id: string, target: { day: string, slot?: Slot, at?: string | null }) {
    return put(await api.post<Meal>(`/eating/meals/${id}/copy`, { ...target }))
  }

  /** Another day's meals onto this one — all of them, or one slot's */
  async function copyDay(target: string, source: { from_day: string, slot?: Slot }) {
    const copies = await api.post<Meal[]>(`/eating/days/${target}/copy`, { ...source })
    copies.forEach(put)
    return copies
  }

  // --- Foods ----------------------------------------------------------------

  async function searchFoods(q = '', limit = 30, mine = false) {
    return api.get<Food[]>('/eating/foods', { query: { q: q || undefined, limit, mine: mine || undefined } })
  }

  /** What adding food opens on: starred foods, then the ones eaten lately */
  async function quickFoods(limit = 12) {
    return api.get<QuickFoods>('/eating/foods/quick', { query: { limit } })
  }

  async function setFavourite(id: string, favourite: boolean) {
    const path = `/eating/foods/${id}/favourite`
    return favourite ? api.request<Food>(path, { method: 'PUT' }) : api.del<Food>(path)
  }

  async function createFood(payload: FoodPayload) {
    return api.post<Food>('/eating/foods', { ...payload })
  }

  /** Only your own foods — the shared staples answer 403 */
  async function updateFood(id: string, payload: Partial<FoodPayload>) {
    return api.patch<Food>(`/eating/foods/${id}`, { ...payload })
  }

  /** Digits the live scanner read (or someone typed off the packet) into a food */
  async function lookupBarcode(code: string) {
    return api.get<ScanResult>(`/eating/foods/barcode/${encodeURIComponent(code)}`)
  }

  /** A photo of the barcode — the server reads it and looks the food up */
  async function scanFood(photo: File) {
    const body = new FormData()
    body.append('photo', photo)
    return api.post<ScanResult>('/eating/foods/scan', body)
  }

  // --- Recipes ---------------------------------------------------------------

  async function loadRecipes(options: { q?: string } = {}) {
    return api.get<Recipe[]>('/eating/recipes', { query: { q: options.q || undefined } })
  }

  async function getRecipe(id: string) {
    return api.get<Recipe>(`/eating/recipes/${id}`)
  }

  async function createRecipe(payload: RecipePayload & { title: string }) {
    return api.post<Recipe>('/eating/recipes', { ...payload })
  }

  /** `items` replaces the whole list — that is how "five eggs, I want two" is saved */
  async function updateRecipe(id: string, payload: RecipePayload) {
    return api.patch<Recipe>(`/eating/recipes/${id}`, { ...payload })
  }

  /** Meals cooked from it keep their items and its name */
  async function removeRecipe(id: string) {
    await api.del(`/eating/recipes/${id}`)
  }

  // --- Export -----------------------------------------------------------------

  async function exportFile(from: string, to: string, format: 'pdf' | 'csv' = 'pdf'): Promise<Blob> {
    return api.request<Blob>('/eating/export', { query: { from, to, format } })
  }

  return {
    settings,
    day,
    dayView,
    meals,
    totals,
    target,
    week,
    loading,
    loadSettings,
    saveSettings,
    estimateGoals,
    loadDay,
    peekDay,
    loadRange,
    loadWeek,
    addMeal,
    updateMeal,
    removeMeal,
    addItem,
    updateItem,
    removeItem,
    parseText,
    attachVoice,
    loadVoice,
    dropVoice,
    mealFromRecipe,
    copyMeal,
    copyDay,
    quickFoods,
    setFavourite,
    searchFoods,
    createFood,
    updateFood,
    scanFood,
    lookupBarcode,
    loadRecipes,
    getRecipe,
    createRecipe,
    updateRecipe,
    removeRecipe,
    exportFile
  }
}

/** Timed meals first, in clock order; the untimed ones keep their own order after */
function sortMeals(list: Meal[]): Meal[] {
  return [...list].sort((a, b) => {
    if (a.at && b.at) {
      return a.at.localeCompare(b.at)
    }
    if (Boolean(a.at) !== Boolean(b.at)) {
      return a.at ? -1 : 1
    }
    return 0
  })
}
