<script setup lang="ts">
import type { Food, Macros, Meal, MealItemPayload, MealTab, Recipe, ScanResult, Slot, Unit } from '~/composables/useEating'
import {
  DRAFT_COLUMNS,
  SLOTS,
  UNIT_ITEMS,
  amountLabel,
  formatGrams,
  formatKcal,
  gramsFor,
  macrosFromFood,
  macrosOf,
  scaleMacros,
  servingsLabel,
  slotForNow,
  slotLabel,
  unitLabel,
  unitsOf
} from '~/composables/useEating'

/**
 * A meal onto a day, written the way it actually happened — five ways in,
 * one list out:
 *
 * - **Search**: find a food in the pantry, say how much.
 * - **Type**: write the plate as a sentence, the server resolves it.
 * - **Recipe**: pick one of your own, set the servings, correct what you
 *   really put in before it is saved.
 * - **Scan**: a photo of the barcode, then the amount.
 * - **Kcal**: just the numbers, for a plate nobody can weigh.
 *
 * Whatever the way, the items land in the same editable list, so nothing is
 * saved before it reads right.
 */
const props = withDefaults(defineProps<{
  /** The day the diary is showing — what a new meal starts on */
  day: string
  /** Set to fill in or edit a meal already in the diary */
  meal?: Meal | null
  /** The tab a new meal opens on */
  start?: MealTab
  /** The slot a new meal goes into; the clock decides when nobody says */
  mealSlot?: Slot | null
}>(), {
  meal: null,
  start: 'search',
  mealSlot: null
})

const emit = defineEmits<{ saved: [Meal] }>()
const open = defineModel<boolean>('open', { default: false })

const {
  addMeal, addItem, updateItem, removeItem, updateMeal,
  parseText, mealFromRecipe, loadRecipes, searchFoods
} = useEating()

/** Filling in a meal that was only written down, rather than adding one */
const filling = computed(() => props.meal ?? null)
const today = useToday()
const toast = useToast()
const haptics = useHaptics()

const TABS: { value: MealTab, label: string, icon: string }[] = [
  { value: 'search', label: 'Search', icon: 'i-lucide-search' },
  { value: 'type', label: 'Type', icon: 'i-lucide-pencil-line' },
  { value: 'recipe', label: 'Recipe', icon: 'i-lucide-book-open' },
  { value: 'scan', label: 'Scan', icon: 'i-lucide-barcode' },
  { value: 'kcal', label: 'Kcal', icon: 'i-lucide-flame' }
]

const tab = ref<MealTab>(props.start)
const saving = ref(false)

const form = reactive({
  day: props.day,
  at: '',
  /** Optional: left empty, the API names it after its one food or its slot */
  title: '',
  slot: slotForNow() as Slot,
  note: ''
})

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

// --- The list every tab feeds -------------------------------------------------

interface Draft {
  key: string
  food_id: string | null
  label: string
  quantity: number
  unit: Unit
  grams: number | null
  /** What the amount was worth when it was resolved — scaled as it changes */
  base: { quantity: number, unit: Unit, macros: Macros, grams: number } | null
  /** Numbers for one serving of a plate with no food behind it */
  direct: Macros | null
}

const items = ref<Draft[]>([])
const unresolved = ref<string[]>([])
let nextKey = 0

function draftKey(): string {
  nextKey += 1
  return `draft-${nextKey}`
}

/** An item's macros follow its amount — as long as the unit is the resolved one */
function macrosOfDraft(draft: Draft): Macros | null {
  if (!draft.base || draft.base.quantity <= 0 || draft.base.unit !== draft.unit) {
    return null
  }
  return scaleMacros(draft.base.macros, draft.quantity / draft.base.quantity)
}

function gramsOfDraft(draft: Draft): number | null {
  if (!draft.base || draft.base.quantity <= 0 || draft.base.unit !== draft.unit) {
    return draft.grams
  }
  return draft.base.grams * (draft.quantity / draft.base.quantity)
}

const known = computed(() => items.value.map(macrosOfDraft).filter((entry): entry is Macros => entry !== null))
const draftTotals = computed<Macros>(() => macrosOf(known.value))
const unpriced = computed(() => items.value.length - known.value.length)

function removeDraft(key: string) {
  items.value = items.value.filter(entry => entry.key !== key)
}

function addFoodDraft(food: Food, quantity: number, unit: Unit) {
  const grams = gramsFor(food, quantity, unit)
  const macros = grams === null ? null : macrosFromFood(food, grams)
  items.value = [...items.value, {
    key: draftKey(),
    food_id: food.id,
    label: food.brand ? `${food.name} · ${food.brand}` : food.name,
    quantity,
    unit,
    grams,
    base: macros && grams !== null ? { quantity, unit, macros, grams } : null,
    direct: null
  }]
}

/** The amount a food opens on: 100 of its base unit, or one of its portions */
function startingAmount(food: Food): { quantity: number, unit: Unit } {
  const unit = unitsOf(food)[0] ?? food.base_unit
  return { quantity: unit === 'g' || unit === 'ml' ? 100 : 1, unit }
}

// --- A food picked (searched or scanned), waiting for its amount ------------------

const pending = ref<Food | null>(null)
const pendingQuantity = ref(100)
const pendingUnit = ref<Unit>('g')

function choose(food: Food) {
  pending.value = food
  const start = startingAmount(food)
  pendingQuantity.value = start.quantity
  pendingUnit.value = start.unit
}

const pendingUnits = computed(() =>
  pending.value ? unitsOf(pending.value).map(unit => ({ value: unit, label: unitLabel(unit) })) : UNIT_ITEMS
)

const pendingMacros = computed<Macros | null>(() => {
  const food = pending.value
  if (!food) {
    return null
  }
  const grams = gramsFor(food, Number(pendingQuantity.value) || 0, pendingUnit.value)
  return grams === null ? null : macrosFromFood(food, grams)
})

function addPending() {
  const food = pending.value
  if (!food) {
    return
  }
  addFoodDraft(food, Number(pendingQuantity.value) || 0, pendingUnit.value)
  pending.value = null
  scan.value = null
}

// --- Search: the pantry -------------------------------------------------------------

const searchQuery = ref('')
const results = ref<Food[]>([])
const searching = ref(false)
/** The search itself failed — not the same as a pantry without the food */
const searchFailed = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
// Each search is numbered: only the newest one's answer, or failure, may land
let searchesAsked = 0

async function runSearch() {
  const q = searchQuery.value.trim()
  const ask = (searchesAsked += 1)
  if (!q) {
    // Cleared mid-search: the one in flight will never land, so its spinner goes now
    results.value = []
    searching.value = false
    searchFailed.value = false
    return
  }
  searching.value = true
  // Typing on: an older answer, or an older failure, must not land over a newer word
  const current = () => ask === searchesAsked && q === searchQuery.value.trim()
  try {
    const found = await searchFoods(q, 20)
    if (current()) {
      results.value = found
      searchFailed.value = false
    }
  } catch {
    if (current()) {
      results.value = []
      searchFailed.value = true
    }
  } finally {
    if (ask === searchesAsked) {
      searching.value = false
    }
  }
}

watch(searchQuery, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => void runSearch(), value.trim() ? 250 : 0)
})

// --- Type: the plate as a sentence ---------------------------------------------------

const quickText = ref('')
const parsing = ref(false)
/** The sentence being read — saving waits for it instead of racing it */
let inFlight: Promise<void> | null = null

function parseQuick(): Promise<void> {
  const text = quickText.value.trim()
  if (!text) {
    return Promise.resolve()
  }
  inFlight ??= readSentence(text).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function readSentence(text: string) {
  parsing.value = true
  try {
    const result = await parseText(text)
    items.value = [
      ...items.value,
      ...result.items.map(entry => ({
        key: draftKey(),
        food_id: entry.food_id,
        label: entry.label,
        quantity: entry.quantity,
        unit: entry.unit,
        grams: entry.grams,
        base: {
          quantity: entry.quantity,
          unit: entry.unit,
          grams: entry.grams,
          macros: { kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs, fat: entry.fat }
        },
        direct: null
      }))
    ]
    unresolved.value = [...unresolved.value, ...result.unknown]
    quickText.value = ''
  } catch (error) {
    fail(error)
  } finally {
    parsing.value = false
  }
}

/** Nothing was recognised in it — keep the words, the numbers stay empty */
function keepAsWritten(chunk: string) {
  items.value = [...items.value, {
    key: draftKey(),
    food_id: null,
    label: chunk,
    quantity: 1,
    unit: 'piece',
    grams: null,
    base: null,
    direct: null
  }]
  unresolved.value = unresolved.value.filter(entry => entry !== chunk)
}

// --- Kcal: just the numbers ------------------------------------------------------------

const direct = reactive({
  label: '',
  kcal: undefined as number | undefined,
  protein: undefined as number | undefined,
  carbs: undefined as number | undefined,
  fat: undefined as number | undefined
})

const DIRECT_FIELDS: { key: 'kcal' | 'protein' | 'carbs' | 'fat', label: string, unit: string, dot: string }[] = [
  { key: 'kcal', label: 'Kcal', unit: 'kcal', dot: 'bg-kcal' },
  { key: 'protein', label: 'Protein', unit: 'g', dot: 'bg-protein' },
  { key: 'carbs', label: 'Carbs', unit: 'g', dot: 'bg-carbs' },
  { key: 'fat', label: 'Fat', unit: 'g', dot: 'bg-fat' }
]

function addDirect() {
  const kcal = Number(direct.kcal) || 0
  if (kcal <= 0) {
    return
  }
  const macros: Macros = {
    kcal,
    protein: Number(direct.protein) || 0,
    carbs: Number(direct.carbs) || 0,
    fat: Number(direct.fat) || 0
  }
  items.value = [...items.value, {
    key: draftKey(),
    food_id: null,
    label: direct.label.trim() || 'Quick add',
    quantity: 1,
    unit: 'serving',
    grams: null,
    base: { quantity: 1, unit: 'serving', macros, grams: 100 },
    direct: macros
  }]
  Object.assign(direct, { label: '', kcal: undefined, protein: undefined, carbs: undefined, fat: undefined })
}

// --- A food that doesn't exist yet -------------------------------------------------

const foodFormOpen = ref(false)
const foodDraftName = ref('')
const foodBarcode = ref<string | null>(null)

function createFoodFor(name: string) {
  foodDraftName.value = name
  foodBarcode.value = null
  foodFormOpen.value = true
}

function onFoodSaved(food: Food) {
  unresolved.value = unresolved.value.filter(entry => entry !== foodDraftName.value)
  foodDraftName.value = ''
  foodBarcode.value = null
  // A new food still has to be measured — the amount panel asks how much
  choose(food)
}

// --- Recipe: your own, scaled -------------------------------------------------------

const recipeQuery = ref('')
const recipes = ref<Recipe[]>([])
const recipesLoading = ref(false)
const picked = ref<Recipe | null>(null)
const servings = ref<number | null>(1)

let recipeTimer: ReturnType<typeof setTimeout> | null = null

async function searchRecipes() {
  recipesLoading.value = true
  try {
    recipes.value = await loadRecipes({ q: recipeQuery.value })
  } catch {
    recipes.value = []
  } finally {
    recipesLoading.value = false
  }
}

watch(recipeQuery, () => {
  if (recipeTimer) {
    clearTimeout(recipeTimer)
  }
  recipeTimer = setTimeout(() => void searchRecipes(), 250)
})

watch(tab, (value) => {
  if (value === 'recipe' && !recipes.value.length && !recipesLoading.value) {
    void searchRecipes()
  }
}, { immediate: true })

interface RecipeDraft {
  key: string
  food_id: string | null
  label: string
  quantity: number
  unit: Unit
  grams: number
  optional: boolean
}

const recipeItems = ref<RecipeDraft[]>([])

/** How much of the recipe is being eaten — its items follow */
const factor = computed(() => {
  const base = picked.value?.servings ?? 1
  return base > 0 ? (servings.value ?? 0) / base : 1
})

function pickRecipe(recipe: Recipe) {
  picked.value = recipe
  servings.value = 1
  recipeItems.value = (recipe.items ?? []).map(item => ({
    key: draftKey(),
    food_id: item.food_id,
    label: item.label,
    quantity: item.quantity,
    unit: item.unit,
    grams: item.grams,
    optional: item.optional
  }))
}

/** The list as it will be saved: the recipe's amounts times the servings */
const scaledRecipeItems = computed(() =>
  recipeItems.value.map(item => ({
    ...item,
    quantity: Number((item.quantity * factor.value).toFixed(3)),
    grams: item.grams * factor.value
  }))
)

/** A recipe known only by its stated numbers still adds up to them */
const recipeTotals = computed<Macros | null>(() => {
  const recipe = picked.value
  if (!recipe) {
    return null
  }
  const source = !recipe.items.length && recipe.stated ? recipe.stated : recipe
  return scaleMacros({ kcal: source.kcal, protein: source.protein, carbs: source.carbs, fat: source.fat }, factor.value)
})

function dropRecipeItem(key: string) {
  recipeItems.value = recipeItems.value.filter(entry => entry.key !== key)
}

function clearRecipe() {
  picked.value = null
  recipeItems.value = []
}

// --- Scan: the barcode ---------------------------------------------------------------

const scan = ref<ScanResult | null>(null)
/** Bumped to open a fresh camera after a miss */
const scanKey = ref(0)

function onScanned(result: ScanResult) {
  scan.value = result
  pending.value = null
  if (result.food) {
    choose(result.food)
  }
}

function rescan() {
  scan.value = null
  scanKey.value += 1
}

function createScannedFood() {
  foodDraftName.value = ''
  foodBarcode.value = scan.value?.barcode ?? null
  foodFormOpen.value = true
}

// --- Saving -------------------------------------------------------------------------

function reset() {
  const meal = props.meal
  items.value = []
  unresolved.value = []
  pending.value = null
  scan.value = null
  searchQuery.value = ''
  results.value = []
  searchFailed.value = false
  recipeQuery.value = ''
  picked.value = null
  recipeItems.value = []
  servings.value = 1
  Object.assign(direct, { label: '', kcal: undefined, protein: undefined, carbs: undefined, fat: undefined })
  if (meal) {
    Object.assign(form, {
      day: meal.day,
      at: meal.at?.slice(0, 5) ?? '',
      title: meal.title,
      slot: meal.slot,
      note: meal.note ?? ''
    })
    // A meal written down in words opens with those words ready to be read;
    // one that already counts opens on the pantry
    quickText.value = meal.items.length ? '' : (meal.note ?? '')
    tab.value = meal.items.length ? 'search' : 'type'
    return
  }
  Object.assign(form, { day: props.day, at: '', title: '', slot: props.mealSlot ?? slotForNow(), note: '' })
  quickText.value = ''
  tab.value = props.start
}

watch(open, (isOpen) => {
  if (isOpen) {
    reset()
  }
}, { immediate: true })

watch(() => props.day, (value) => {
  if (!open.value) {
    form.day = value
  }
})

const fromRecipe = computed(() => tab.value === 'recipe' && picked.value !== null)

// --- One drafted list, whichever way the food got here ---------------------------

/**
 * Every tab ends at the same table. The rows still point at their own source
 * object — editing a cell writes straight back into `items` or `recipeItems`
 * — so this is a view over them, never a copy.
 */
interface DraftedRow {
  key: string
  entry: Draft | RecipeDraft
  macros: Macros | null
  grams: number | null
  /** What a serving change actually puts on the plate, when it differs */
  scaled: { quantity: number, unit: Unit, grams: number } | null
  optional: boolean
  /** Counted in servings of its own numbers — the unit can't be changed */
  direct: boolean
}

const drafted = computed<DraftedRow[]>(() => {
  if (fromRecipe.value) {
    return recipeItems.value.map((entry, index) => {
      const scaled = scaledRecipeItems.value[index]
      return {
        key: entry.key,
        entry,
        macros: null,
        grams: scaled?.grams ?? entry.grams,
        // The inputs hold the recipe's own amounts; this says what is eaten
        scaled: scaled && Math.abs(factor.value - 1) > 0.001
          ? { quantity: scaled.quantity, unit: scaled.unit, grams: scaled.grams }
          : null,
        optional: entry.optional,
        direct: false
      }
    })
  }
  return items.value.map(entry => ({
    key: entry.key,
    entry,
    macros: macrosOfDraft(entry),
    grams: entry.direct ? null : gramsOfDraft(entry),
    scaled: null,
    optional: false,
    direct: entry.direct !== null
  }))
})

/** What the whole table comes to — the recipe scales, the plate adds up */
const draftedTotals = computed<Macros | null>(() =>
  fromRecipe.value ? recipeTotals.value : (items.value.length ? draftTotals.value : null))

function removeRow(row: DraftedRow) {
  if (fromRecipe.value) {
    dropRecipeItem(row.key)
    return
  }
  removeDraft(row.key)
}

/** Words alone are enough: a meal can be written down now and counted later */
const noteOnly = computed(
  () => !fromRecipe.value && !items.value.length && quickText.value.trim().length > 0
)

/** A date field cleared on a phone holds "", and an iPhone offers next week */
const dayError = computed(() => dayRefusal(form.day, today.value))

const canSave = computed(() =>
  !dayError.value && (fromRecipe.value
    // A recipe known only by its numbers has no rows and is still a plate —
    // but some of it has to have been eaten
    ? (servings.value ?? 0) > 0 && (recipeItems.value.length > 0 || Boolean(picked.value?.stated))
    // Editing an existing meal: its day, time, name and note are enough to save
    : items.value.length > 0 || noteOnly.value || filling.value !== null)
)

function payloadItems(): MealItemPayload[] {
  return items.value.map(entry => ({
    food_id: entry.food_id,
    label: entry.label.trim() || 'Item',
    // An emptied amount field holds null, which the API would refuse
    quantity: Number(entry.quantity) || 0,
    unit: entry.unit,
    ...(entry.direct ? { macros: entry.direct } : {})
  }))
}

/**
 * A recipe is copied by the server and then corrected: whatever was changed
 * in the preview is applied to the copy item by item. Matching on the label
 * rather than the position keeps it right when a row was removed.
 */
async function applyRecipeEdits(meal: Meal): Promise<Meal> {
  if (!recipeItems.value.length) {
    return meal
  }
  let current = meal
  const remaining = [...meal.items]
  for (const entry of scaledRecipeItems.value) {
    const index = remaining.findIndex(item => item.label.trim().toLowerCase() === entry.label.trim().toLowerCase())
    if (index === -1) {
      current = await addItem(current.id, {
        food_id: entry.food_id,
        label: entry.label,
        quantity: entry.quantity,
        unit: entry.unit
      })
      continue
    }
    const [item] = remaining.splice(index, 1)
    if (!item) {
      continue
    }
    const moved = Math.abs(item.quantity - entry.quantity) > 0.001 || item.unit !== entry.unit
    if (moved) {
      current = await updateItem(current.id, item.id, { quantity: entry.quantity, unit: entry.unit })
    }
  }
  for (const leftover of remaining) {
    current = await removeItem(current.id, leftover.id)
  }
  return current
}

async function save() {
  if (!canSave.value || saving.value) {
    return
  }
  saving.value = true
  try {
    // A sentence read and saved in one breath: its foods are still on their
    // way, and they belong on this meal rather than being kept as a note
    await inFlight
    let meal: Meal
    if (fromRecipe.value && picked.value) {
      meal = await mealFromRecipe({
        recipe_id: picked.value.id,
        day: form.day,
        at: form.at || null,
        slot: form.slot,
        servings: servings.value ?? 1
      })
      meal = await applyRecipeEdits(meal)
      const title = form.title.trim()
      if (title && title !== meal.title) {
        meal = await updateMeal(meal.id, { title })
      }
      if (form.note.trim()) {
        meal = await updateMeal(meal.id, { note: form.note.trim() })
      }
    } else if (filling.value) {
      // The meal is already in the diary; this adds the numbers to it
      meal = filling.value
      for (const item of payloadItems()) {
        meal = await addItem(meal.id, item)
      }
      const title = form.title.trim() || meal.title
      const note = form.note.trim() || null
      const at = form.at || null
      const timeMoved = (at ?? '') !== (meal.at?.slice(0, 5) ?? '')
      // The day and the slot are on the form too: editing is also how a meal moves
      if (title !== meal.title || note !== meal.note || timeMoved || form.day !== meal.day || form.slot !== meal.slot) {
        meal = await updateMeal(meal.id, { title, note, at, day: form.day, slot: form.slot })
      }
    } else {
      // Nothing recognised and nothing typed into the rows: keep the words
      // as the note, so the plate is written down and can be counted later
      const written = quickText.value.trim()
      meal = await addMeal({
        day: form.day,
        at: form.at || null,
        title: form.title.trim() || undefined,
        slot: form.slot,
        note: [form.note.trim(), noteOnly.value ? written : ''].filter(Boolean).join(' · ') || null,
        items: payloadItems()
      })
    }
    haptics.success()
    emit('saved', meal)
    open.value = false
    toast.add({
      title: filling.value
        ? (filling.value.items.length ? `${meal.title} saved` : `${meal.title} counted`)
        : noteOnly.value
          ? `${meal.title} written down — numbers whenever you like`
          : `${meal.title} written down`,
      icon: 'i-lucide-utensils',
      color: 'success'
    })
  } catch (error) {
    fail(error)
  } finally {
    saving.value = false
  }
}

/** The amount cell reads like a ledger number, not like a form field */
const AMOUNT_UI = { base: 'tabular-nums px-2 text-right' }

/** A list inside the sheet: a group of rows with hairlines, no card around it */
const GROUP = 'flex flex-col divide-y divide-default overflow-hidden rounded-tile border border-default'
</script>

<template>
  <FormSheet
    v-model:open="open"
    :title="!filling ? 'New meal' : filling.items.length ? 'Edit the meal' : 'Fill in the meal'"
    :description="!filling
      ? 'Find it, type it, cook it from a recipe, scan it — or just the kcal.'
      : filling.items.length
        ? 'Its day, time and name — and anything else that went on the plate.'
        : 'It is already in the diary — these are the numbers for it.'"
    :loading="saving"
    :disabled="!canSave"
    @submit="save"
  >
    <!-- When, and what it is called -->
    <div class="grid grid-cols-2 gap-3">
      <UFormField
        label="Day"
        :error="dayError ?? false"
      >
        <input
          v-model="form.day"
          type="date"
          :max="today"
          class="app-field"
          aria-label="Day"
        >
      </UFormField>
      <UFormField
        label="Time"
        hint="optional"
      >
        <input
          v-model="form.at"
          type="time"
          class="app-field"
          aria-label="Time"
        >
      </UFormField>
      <UFormField
        label="Meal"
        class="col-span-2"
      >
        <ShellSegmented
          v-model="form.slot"
          label="Meal"
          size="sm"
          :options="SLOTS.map(entry => ({ value: entry.value, label: entry.label }))"
        />
      </UFormField>
      <UFormField
        label="Name"
        hint="optional"
        class="col-span-2"
      >
        <UInput
          v-model="form.title"
          :placeholder="items.length === 1 ? items[0]?.label : slotLabel(form.slot)"
          class="w-full"
        />
      </UFormField>
    </div>

    <!-- Five ways in -->
    <div
      class="grid grid-cols-5 gap-1 rounded-tile bg-elevated p-1"
      role="group"
      aria-label="How to add"
    >
      <button
        v-for="entry in TABS"
        :key="entry.value"
        type="button"
        class="flex min-w-0 flex-col items-center gap-0.5 rounded-xl py-2 text-caption font-semibold outline-none transition-colors duration-200 ease-soft focus-visible:ring-2 focus-visible:ring-primary"
        :class="tab === entry.value ? 'bg-default text-highlighted shadow-card ring-1 ring-default dark:bg-accented' : 'text-muted active:bg-default/60'"
        :aria-pressed="tab === entry.value"
        @click="tab = entry.value"
      >
        <UIcon
          :name="entry.icon"
          class="size-5"
          :class="tab === entry.value ? 'text-primary' : ''"
        />
        {{ entry.label }}
      </button>
    </div>

    <!-- SEARCH -->
    <div
      v-if="tab === 'search'"
      class="flex flex-col gap-3"
    >
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search foods — egg, oats, banana…"
        class="w-full"
        :loading="searching"
        autofocus
      />
      <div
        v-if="results.length && !pending"
        class="max-h-72 overflow-y-auto"
        :class="GROUP"
      >
        <button
          v-for="food in results"
          :key="food.id"
          type="button"
          class="flex min-h-14 items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:bg-elevated/60 active:bg-elevated/70"
          @click="choose(food)"
        >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="flex min-w-0 items-center gap-2">
              <span class="truncate text-body font-semibold text-highlighted">{{ food.name }}</span>
              <span
                v-if="food.mine"
                class="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-micro font-semibold tracking-wide text-muted uppercase"
              >Mine</span>
            </span>
            <span
              v-if="food.brand"
              class="truncate text-xs text-muted"
            >{{ food.brand }}</span>
          </span>
          <span class="flex w-14 shrink-0 flex-col items-end leading-tight tabular-nums">
            <span class="text-body font-semibold text-highlighted">{{ formatKcal(food.kcal) }}</span>
            <span class="text-caption text-muted">/100 {{ food.base_unit }}</span>
          </span>
        </button>
      </div>
      <ShellEmpty
        v-else-if="searchFailed && searchQuery.trim() && !searching && !pending"
        compact
        icon="i-lucide-wifi-off"
        title="The search didn't load"
        description="Nothing is lost — check the connection and try again."
        class="rounded-tile bg-elevated/60"
      >
        <UButton
          label="Try again"
          size="sm"
          variant="soft"
          @click="runSearch"
        />
      </ShellEmpty>
      <ShellEmpty
        v-else-if="searchQuery.trim() && !searching && !pending"
        compact
        icon="i-lucide-search-x"
        title="Not in the pantry yet"
        description="Add it once and it is yours."
        class="rounded-tile bg-elevated/60"
      >
        <UButton
          label="New food"
          icon="i-lucide-plus"
          size="sm"
          variant="soft"
          @click="createFoodFor(searchQuery.trim())"
        />
      </ShellEmpty>
    </div>

    <!-- TYPE -->
    <div
      v-else-if="tab === 'type'"
      class="flex flex-col gap-3"
    >
      <UTextarea
        v-model="quickText"
        :rows="2"
        autoresize
        placeholder="50g oats, 1 scoop whey, 1 banana"
        class="w-full"
        :disabled="parsing"
        @keydown.enter.exact.prevent="parseQuick"
      />
      <div class="flex items-start gap-3">
        <p class="text-xs text-muted">
          Read finds the foods in the line — they land below, editable.
          <template v-if="!filling">
            Or save it as written and count it later.
          </template>
        </p>
        <UButton
          label="Read"
          icon="i-lucide-wand-sparkles"
          size="sm"
          variant="soft"
          class="ml-auto shrink-0"
          :loading="parsing"
          :disabled="!quickText.trim()"
          @click="parseQuick"
        />
      </div>

      <!-- What it could not place -->
      <div
        v-if="unresolved.length"
        class="flex flex-col gap-1 rounded-tile bg-warning/10 px-3.5 py-3"
      >
        <span class="app-eyebrow text-warning">Not recognised</span>
        <div
          v-for="chunk in unresolved"
          :key="chunk"
          class="flex flex-wrap items-center gap-x-2 gap-y-1"
        >
          <span class="min-w-0 flex-1 truncate text-sm text-default">{{ chunk }}</span>
          <UButton
            label="Keep as written"
            size="sm"
            color="neutral"
            variant="ghost"
            @click="keepAsWritten(chunk)"
          />
          <UButton
            label="New food"
            icon="i-lucide-plus"
            size="sm"
            variant="soft"
            @click="createFoodFor(chunk)"
          />
        </div>
      </div>
    </div>

    <!-- RECIPE -->
    <div
      v-else-if="tab === 'recipe'"
      class="flex flex-col gap-3"
    >
      <template v-if="!picked">
        <UInput
          v-model="recipeQuery"
          icon="i-lucide-search"
          placeholder="Search your recipes…"
          class="w-full"
        />
        <ShellSkeleton
          v-if="recipesLoading"
          variant="rows"
          :count="2"
          :class="GROUP"
        />
        <ShellEmpty
          v-else-if="!recipes.length"
          compact
          icon="i-lucide-book-open"
          :title="recipeQuery ? 'Nothing found' : 'No recipes yet'"
          :description="recipeQuery ? 'Try another word from its name.' : 'Write your first one in the Library.'"
          class="rounded-tile bg-elevated/60"
        />
        <div
          v-else
          class="max-h-64 overflow-y-auto"
          :class="GROUP"
        >
          <button
            v-for="recipe in recipes"
            :key="recipe.id"
            type="button"
            class="flex min-h-14 items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:bg-elevated/60 active:bg-elevated/70"
            @click="pickRecipe(recipe)"
          >
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-body font-semibold text-highlighted">{{ recipe.title }}</span>
              <span class="truncate text-xs text-muted">
                <template v-if="recipe.subtitle">{{ recipe.subtitle }} · </template>{{ servingsLabel(recipe) }}
              </span>
            </span>
            <span class="flex w-14 shrink-0 flex-col items-end leading-tight tabular-nums">
              <span class="text-body font-semibold text-highlighted">{{ formatKcal(!recipe.items.length && recipe.stated ? recipe.stated.kcal : recipe.kcal) }}</span>
              <span class="text-caption text-muted">kcal</span>
            </span>
          </button>
        </div>
      </template>

      <template v-else>
        <div class="flex items-center gap-3 rounded-tile bg-elevated/70 py-2.5 pr-2 pl-3.5">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-default text-primary shadow-card">
            <UIcon
              name="i-lucide-book-open"
              class="size-4.5"
            />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-body font-semibold text-highlighted">{{ picked.title }}</span>
            <span class="text-xs text-muted tabular-nums">makes {{ servingsLabel(picked) }}</span>
          </span>
          <UButton
            icon="i-lucide-x"
            size="sm"
            color="neutral"
            variant="ghost"
            square
            class="app-hit"
            aria-label="Pick another recipe"
            @click="clearRecipe"
          />
        </div>
        <div class="grid grid-cols-[7rem_minmax(0,1fr)] items-end gap-3">
          <UFormField
            :label="picked.serving_unit === 'piece' ? 'Pieces eaten' : 'Servings eaten'"
            :hint="`of ${picked.servings}`"
          >
            <DecimalInput
              v-model="servings"
              class="w-full"
              :ui="AMOUNT_UI"
            />
          </UFormField>
          <p class="pb-1 text-xs text-muted">
            Corrections below go onto this meal only — the recipe stays as it is.
          </p>
        </div>
      </template>
    </div>

    <!-- SCAN -->
    <div
      v-else-if="tab === 'scan'"
      class="flex flex-col gap-3"
    >
      <BarcodeScanner
        v-if="!scan || scan.food"
        :key="scanKey"
        @result="onScanned"
      />
      <UButton
        v-else
        label="Scan another"
        icon="i-lucide-scan-barcode"
        color="neutral"
        variant="soft"
        size="lg"
        block
        @click="rescan"
      />

      <!-- No food behind the barcode: say so, and offer to add it once -->
      <div
        v-if="scan && !scan.food"
        class="flex flex-col gap-2 rounded-tile bg-warning/10 px-3.5 py-3"
      >
        <p class="flex items-start gap-2 text-sm text-default">
          <UIcon
            name="i-lucide-circle-help"
            class="mt-0.5 size-4 shrink-0 text-warning"
          />
          <span class="min-w-0">{{ scan.message ?? 'No food behind that barcode yet.' }}</span>
        </p>
        <p
          v-if="scan.barcode"
          class="flex items-center gap-1.5 pl-6 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-barcode"
            class="size-3.5"
          />
          <span class="tabular-nums">{{ scan.barcode }}</span>
        </p>
        <UButton
          v-if="scan.barcode"
          label="Add it from the label"
          icon="i-lucide-plus"
          size="sm"
          variant="soft"
          class="ml-6 self-start"
          @click="createScannedFood"
        />
      </div>
    </div>

    <!-- KCAL -->
    <div
      v-else
      class="flex flex-col gap-3"
    >
      <UFormField label="What was it?">
        <UInput
          v-model="direct.label"
          placeholder="Slice of cake at the office"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField
          v-for="field in DIRECT_FIELDS"
          :key="field.key"
          :ui="{ label: 'flex items-center gap-1.5' }"
        >
          <template #label>
            <span
              class="size-2 rounded-full"
              :class="field.dot"
            />
            {{ field.label }}
          </template>
          <DecimalInput
            v-model="direct[field.key]"
            placeholder="—"
            class="w-full"
            :ui="{ base: 'tabular-nums', trailing: 'pointer-events-none' }"
          >
            <template #trailing>
              <span class="text-xs text-dimmed">{{ field.unit }}</span>
            </template>
          </DecimalInput>
        </UFormField>
      </div>
      <UButton
        label="Put it on the plate"
        icon="i-lucide-plus"
        variant="soft"
        class="self-end"
        :disabled="!direct.kcal || direct.kcal <= 0"
        @click="addDirect"
      />
    </div>

    <!-- A food picked from the pantry or off a barcode, waiting for its amount -->
    <div
      v-if="pending && (tab === 'search' || tab === 'scan')"
      class="flex flex-col gap-3 rounded-tile bg-primary/6 p-3.5 border border-primary/20"
    >
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-badge-check"
          class="size-5 shrink-0 text-primary"
        />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-body font-semibold text-highlighted">{{ pending.name }}</span>
          <span class="flex items-baseline gap-2 text-caption text-muted">
            <span
              v-if="pending.brand"
              class="truncate"
            >{{ pending.brand }} ·</span>
            <span class="shrink-0 tabular-nums">{{ formatKcal(pending.kcal) }} kcal / 100 {{ pending.base_unit }}</span>
          </span>
        </span>
        <UButton
          icon="i-lucide-x"
          size="sm"
          color="neutral"
          variant="ghost"
          square
          class="app-hit"
          aria-label="Pick another food"
          @click="pending = null"
        />
      </div>

      <div class="grid grid-cols-[5rem_7rem_minmax(0,1fr)] items-end gap-2">
        <UFormField label="How much">
          <DecimalInput
            v-model="pendingQuantity"
            class="w-full"
            :ui="AMOUNT_UI"
          />
        </UFormField>
        <USelect
          v-model="pendingUnit"
          :items="pendingUnits"
          value-key="value"
          class="w-full"
          aria-label="Unit"
        />
        <UButton
          label="Add"
          icon="i-lucide-plus"
          class="justify-center"
          @click="addPending"
        />
      </div>

      <div
        v-if="pendingMacros"
        class="flex items-baseline justify-between gap-2 border-t border-primary/15 pt-2.5"
      >
        <ShellMacroLine
          :macros="pendingMacros"
          :kcal="false"
          size="xs"
        />
        <span class="text-sm font-bold text-highlighted tabular-nums">{{ formatKcal(pendingMacros.kcal) }} kcal</span>
      </div>
    </div>

    <!-- The plate, as it will be saved. Every tab lands here: the name across,
         then amount · unit · what it comes to, the kcal down one column. -->
    <section
      v-if="fromRecipe || tab !== 'recipe' || drafted.length"
      class="flex flex-col gap-2"
      aria-labelledby="meal-form-plate"
    >
      <h3
        id="meal-form-plate"
        class="flex items-center gap-2 px-1"
      >
        <span class="app-eyebrow">On the plate</span>
        <span class="rounded-full bg-elevated px-2 py-0.5 text-caption font-semibold text-toned tabular-nums">{{ drafted.length }}</span>
      </h3>

      <div :class="GROUP">
        <p
          v-if="!drafted.length"
          class="px-4 py-3.5 text-sm text-muted"
        >
          {{ fromRecipe ? 'This recipe is counted by its stated numbers.' : 'Nothing on it yet — add a food above.' }}
        </p>

        <div
          v-for="row in drafted"
          :key="row.key"
          class="px-3 py-2.5"
          :class="DRAFT_COLUMNS"
        >
          <UInput
            v-model="row.entry.label"
            variant="none"
            placeholder="Name"
            class="col-span-3 min-w-0"
            :ui="{ root: 'w-full', base: 'px-1 py-1 text-body font-medium text-highlighted' }"
            :aria-label="`Name of ${row.entry.label}`"
          />
          <UButton
            icon="i-lucide-x"
            size="sm"
            color="neutral"
            variant="ghost"
            square
            class="app-hit justify-self-end text-dimmed"
            :aria-label="`Remove ${row.entry.label}`"
            @click="removeRow(row)"
          />
          <DecimalInput
            v-model="row.entry.quantity"
            size="sm"
            class="w-full"
            :ui="AMOUNT_UI"
            :aria-label="`Amount of ${row.entry.label}`"
          />
          <span
            v-if="row.direct"
            class="px-2 text-sm text-muted"
          >{{ unitLabel('serving', row.entry.quantity) }}</span>
          <USelect
            v-else
            v-model="row.entry.unit"
            :items="UNIT_ITEMS"
            value-key="value"
            size="sm"
            class="w-full"
            :aria-label="`Unit for ${row.entry.label}`"
          />
          <!-- What this line comes to, right-aligned under the kcal column -->
          <span class="col-span-2 flex min-w-0 flex-col items-end gap-0.5 text-right">
            <span class="text-xs font-semibold text-highlighted tabular-nums">
              <template v-if="row.macros">{{ formatKcal(row.macros.kcal) }} kcal</template>
              <span
                v-else
                class="text-dimmed"
              >—</span><span
                v-if="row.grams !== null && !row.direct"
                class="font-normal text-dimmed"
              > · {{ formatGrams(row.grams) }}</span>
            </span>
            <ShellMacroLine
              v-if="row.macros"
              :macros="row.macros"
              :kcal="false"
              class="justify-end"
            />
          </span>
          <!-- Only when there is more to say than the grams above -->
          <span
            v-if="row.scaled || row.direct || row.optional || row.grams === null"
            class="col-span-4 truncate px-1 text-caption text-dimmed tabular-nums"
          >
            <template v-if="row.scaled">→ {{ amountLabel(row.scaled.quantity, row.scaled.unit) }} on the plate</template>
            <template v-else-if="row.direct">typed in</template>
            <template v-else-if="row.grams === null">no weight</template>
            <template v-if="row.optional">{{ row.scaled || row.direct || row.grams === null ? ' · ' : '' }}optional</template>
          </span>
        </div>

        <!-- What the plate comes to -->
        <div
          v-if="draftedTotals"
          class="flex items-center justify-between gap-3 bg-elevated/60 px-4 py-3"
        >
          <span class="text-sm font-semibold text-default">
            {{ fromRecipe ? 'The whole plate' : 'Total' }}
          </span>
          <span class="flex flex-col items-end gap-0.5">
            <span class="text-body font-bold text-highlighted tabular-nums">{{ formatKcal(draftedTotals.kcal) }} kcal</span>
            <ShellMacroLine
              :macros="draftedTotals"
              :kcal="false"
              class="justify-end"
            />
          </span>
        </div>

        <p
          v-if="!fromRecipe && unpriced > 0"
          class="px-4 py-2.5 text-xs text-muted"
        >
          {{ unpriced }} {{ unpriced === 1 ? 'item counts' : 'items count' }} for nothing — no food behind {{ unpriced === 1 ? 'it' : 'them' }} yet.
        </p>
      </div>
    </section>

    <UFormField
      label="Note"
      hint="optional"
    >
      <UTextarea
        v-model="form.note"
        :rows="2"
        autoresize
        placeholder="Ate out, guessed the oil…"
        class="w-full"
      />
    </UFormField>

    <FoodForm
      v-model:open="foodFormOpen"
      :barcode="foodBarcode"
      :name="foodDraftName"
      @saved="onFoodSaved"
    />

    <template #footer>
      <div class="flex w-full items-center gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          size="lg"
          :disabled="saving"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="form-sheet"
          size="lg"
          class="flex-1 justify-center"
          :loading="saving"
          :disabled="!canSave"
        >
          {{ filling
            ? (filling.items.length ? 'Save' : 'Count it')
            : noteOnly ? 'Write it down' : 'Add meal' }}
          <span
            v-if="draftedTotals && canSave"
            class="font-medium opacity-75 tabular-nums"
          >· {{ formatKcal(draftedTotals.kcal) }} kcal</span>
        </UButton>
      </div>
    </template>
  </FormSheet>
</template>
