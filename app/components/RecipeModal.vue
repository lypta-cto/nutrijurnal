<script setup lang="ts">
import type { Food, Meal, Recipe, RecipeItemPayload, Unit } from '~/composables/useEating'
import {
  MACRO_BARS,
  SERVING_UNITS,
  dayLabel,
  formatGrams,
  formatKcal,
  formatMacro,
  gramsFor,
  perServing,
  servingsLabel,
  statedGap,
  unitItemsFor
} from '~/composables/useEating'

/**
 * One recipe, open: its ingredients as editable rows, its steps, and the
 * two things ever wanted from it — put it on a day, or correct it for good.
 *
 * "It says five eggs, I use two" is saved by replacing the whole item list;
 * meals already cooked from it keep the amounts they were cooked with.
 */
const props = defineProps<{
  /** The row that was clicked; null while nothing is open */
  recipe: Recipe | null
}>()

const emit = defineEmits<{ saved: [Recipe], added: [Meal], removed: [Recipe] }>()
const open = defineModel<boolean>('open', { default: false })
useSheetHistory(open)

const { getRecipe, updateRecipe, removeRecipe, mealFromRecipe, searchFoods, parseText } = useEating()
const toast = useToast()
const { confirm } = useConfirm()

const full = ref<Recipe | null>(null)
const saving = ref(false)
const adding = ref(false)

interface Line {
  key: string
  id: string | null
  food_id: string | null
  label: string
  quantity: number
  unit: Unit
  grams: number
  optional: boolean
}

const form = reactive({
  title: '',
  subtitle: '',
  minutes: null as number | null,
  servings: 1,
  /** A stew is divided into servings, a tray of muffins into pieces */
  serving_unit: 'serving' as 'serving' | 'piece',
  steps: '',
  note: ''
})
const lines = ref<Line[]>([])
let nextKey = 0

function fill(recipe: Recipe) {
  full.value = recipe
  // The keys below are new, so anything remembered against the old ones is dead
  foodOf.value.clear()
  choices.value.clear()
  missing.value.clear()
  Object.assign(form, {
    title: recipe.title,
    subtitle: recipe.subtitle ?? '',
    minutes: recipe.minutes,
    servings: recipe.servings,
    serving_unit: recipe.serving_unit,
    steps: (recipe.steps ?? []).join('\n'),
    note: recipe.note ?? ''
  })
  lines.value = (recipe.items ?? []).map((item) => {
    nextKey += 1
    return {
      key: `line-${nextKey}`,
      id: item.id,
      food_id: item.food_id,
      label: item.label,
      quantity: item.quantity,
      unit: item.unit,
      grams: item.grams,
      optional: item.optional
    }
  })
}

watch(open, async (isOpen) => {
  if (!isOpen || !props.recipe) {
    return
  }
  fill(props.recipe)
  planning.value = false
  editingSteps.value = false
  // The list may have arrived brief — the steps and items are fetched whole
  try {
    fill(await getRecipe(props.recipe.id))
    await adoptFoods()
  } catch {
    // The row's own copy is enough to work with
  }
})

const each = computed(() => (shown.value ? perServing(shown.value) : null))

/**
 * What the recipe comes to. Normally that is the ingredients added up — but a
 * dish copied off a label or a plan may have no ingredients at all, only the
 * numbers that were printed. Showing that as "0 kcal" would be a lie about a
 * real plate, so the stated numbers stand in until somebody writes the
 * ingredients down.
 */
const statedOnly = computed(() =>
  Boolean(full.value && !full.value.items?.length && full.value.stated))

const shown = computed(() => {
  const recipe = full.value
  if (!recipe) {
    return null
  }
  return statedOnly.value && recipe.stated ? { ...recipe, ...recipe.stated } : recipe
})

const gap = computed(() => (full.value ? statedGap(full.value) : null))

/** The whole recipe, as a row of numbers in the diary's own colours */
const summary = computed(() => {
  const recipe = full.value
  if (!recipe) {
    return []
  }
  // The batch, and — when it divides — what one of them comes to. Both
  // numbers on one line: the recipe is written per batch but eaten per piece.
  const source = shown.value ?? recipe
  return MACRO_BARS.map(bar => ({
    ...bar,
    value: source[bar.key],
    per: each.value && recipe.servings > 1 ? each.value[bar.key] : null
  }))
})

// --- Steps: read first, edit on purpose ------------------------------------------

/** The steps as they read, one per line — the textarea is still the editor */
const stepList = computed(() => form.steps.split('\n').map(step => step.trim()).filter(Boolean))
const editingSteps = ref(false)

/**
 * The whole ingredient list in one line, the way the diary takes a meal:
 * "8 eggs, 220g cottage cheese, 70g ham" becomes three rows with their foods
 * already behind them. Typing a batch row by row is what made writing a
 * recipe down feel like paperwork.
 */
const pasting = ref(false)
const pasted = ref('')
const reading = ref(false)

/** The pasted list being read — saving waits for its rows instead of racing them */
let pasteInFlight: Promise<void> | null = null

function readPasted(): Promise<void> {
  const text = pasted.value.trim()
  if (!text) {
    return Promise.resolve()
  }
  pasteInFlight ??= readLines(text).finally(() => {
    pasteInFlight = null
  })
  return pasteInFlight
}

async function readLines(text: string) {
  reading.value = true
  try {
    const { items, unknown } = await parseText(text)

    for (const item of items) {
      nextKey += 1
      const key = `line-${nextKey}`
      lines.value = [...lines.value, {
        key,
        id: null,
        food_id: item.food_id,
        label: item.label,
        quantity: item.quantity,
        unit: item.unit,
        grams: item.grams,
        optional: false
      }]
    }

    // What the parser could not place still gets a row — it is easier to
    // correct a line that is there than to notice one that is missing
    for (const chunk of unknown) {
      nextKey += 1
      const key = `line-${nextKey}`
      lines.value = [...lines.value, {
        key,
        id: null,
        food_id: null,
        label: chunk,
        quantity: 1,
        unit: 'g',
        grams: 0,
        optional: false
      }]
      missing.value.add(key)
    }

    pasted.value = ''
    pasting.value = false

    if (unknown.length) {
      toast.add({
        title: `${unknown.length} ${unknown.length === 1 ? 'line' : 'lines'} had no food`,
        description: unknown.join(', '),
        icon: 'i-lucide-triangle-alert',
        color: 'warning'
      })
    }
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    reading.value = false
  }
}

function addLine() {
  nextKey += 1
  lines.value = [...lines.value, {
    key: `line-${nextKey}`,
    id: null,
    food_id: null,
    label: '',
    quantity: 1,
    unit: 'g',
    grams: 0,
    optional: false
  }]
}

/**
 * An ingredient is worth nothing until it points at a food: without one the
 * row weighs nothing and the whole recipe adds up to zero. So what is typed
 * is looked up the moment the row settles, by the same search the Foods list
 * uses — "jaja" finds Jaje, endings and all.
 *
 * One match is taken; several are offered, because guessing between "Beli
 * sir" and "Mladi luk" silently is how a recipe ends up quietly wrong. None
 * says so plainly, and the row still saves as written.
 */
const foodOf = ref(new Map<string, Food>())
/** Rows whose text fits more than one food — the person says which */
const choices = ref(new Map<string, Food[]>())
/** Lookups still in the air, keyed by row — saving waits on these */
const inflight = new Map<string, Promise<void>>()
const looking = ref(new Set<string>())
const missing = ref(new Set<string>())

function weigh(line: Line) {
  const food = foodOf.value.get(line.key)
  line.grams = food ? (gramsFor(food, Number(line.quantity) || 0, line.unit) ?? 0) : 0
}

/** The row now names this food, and weighs what that food says it weighs */
function pick(line: Line, food: Food) {
  foodOf.value.set(line.key, food)
  line.food_id = food.id
  line.label = food.name
  missing.value.delete(line.key)
  choices.value.delete(line.key)
  weigh(line)
}

function resolveLine(line: Line): Promise<void> {
  const run = lookUp(line).finally(() => {
    if (inflight.get(line.key) === run) {
      inflight.delete(line.key)
    }
  })
  inflight.set(line.key, run)
  return run
}

async function lookUp(line: Line) {
  const label = line.label.trim()
  if (!label) {
    foodOf.value.delete(line.key)
    choices.value.delete(line.key)
    missing.value.delete(line.key)
    line.food_id = null
    line.grams = 0
    return
  }

  // Already pointing at the food this text names — only the amount moved
  if (foodOf.value.get(line.key)?.name.toLowerCase() === label.toLowerCase()) {
    weigh(line)
    return
  }

  looking.value.add(line.key)
  try {
    const found = await searchFoods(label, 5)
    choices.value.delete(line.key)
    missing.value.delete(line.key)

    if (found.length === 1 && found[0]) {
      pick(line, found[0])
    } else if (found.length > 1) {
      choices.value.set(line.key, found)
      foodOf.value.delete(line.key)
      line.food_id = null
      line.grams = 0
    } else {
      foodOf.value.delete(line.key)
      line.food_id = null
      line.grams = 0
      missing.value.add(line.key)
    }
  } catch {
    // A failed lookup leaves the row exactly as typed; saving still works
  } finally {
    looking.value.delete(line.key)
  }
}

/** Existing rows already carry a food — find it once so amounts can be reweighed */
async function adoptFoods() {
  await Promise.all(
    lines.value
      .filter(line => line.food_id && !foodOf.value.has(line.key) && line.label.trim())
      .map(async (line) => {
        const [best] = await searchFoods(line.label.trim(), 1)
        if (best && best.id === line.food_id) {
          foodOf.value.set(line.key, best)
        }
      })
  )
}

function dropLine(key: string) {
  lines.value = lines.value.filter(line => line.key !== key)
}

const itemsPayload = computed<RecipeItemPayload[]>(() =>
  lines.value
    .filter(line => line.label.trim())
    .map(line => ({
      food_id: line.food_id,
      label: line.label.trim(),
      quantity: Number(line.quantity) || 0,
      unit: line.unit,
      optional: line.optional
    }))
)

/** An emptied number field is "not known", never a zero */
function numberOrNull(value: number | null): number | null {
  return Number.isFinite(value) ? Number(value) : null
}

/**
 * Whether anything has actually been changed. It is what makes the two
 * footer actions unmistakable: with edits pending, saving them is the
 * obvious thing; without, putting the recipe on a day is.
 */
const dirty = computed(() => {
  const recipe = full.value
  if (!recipe) {
    return false
  }
  const fingerprint = (items: RecipeItemPayload[]) =>
    items.map(item => `${item.label}|${item.quantity}|${item.unit}|${item.optional ? 1 : 0}`).join(';')
  return form.title.trim() !== recipe.title
    || (form.subtitle.trim() || null) !== (recipe.subtitle ?? null)
    || numberOrNull(form.minutes) !== recipe.minutes
    || (numberOrNull(form.servings) ?? 1) !== recipe.servings
    || form.serving_unit !== recipe.serving_unit
    || stepList.value.join('\n') !== (recipe.steps ?? []).join('\n')
    || (form.note.trim() || null) !== (recipe.note ?? null)
    || fingerprint(itemsPayload.value) !== fingerprint((recipe.items ?? []).map(item => ({
      label: item.label.trim(),
      quantity: item.quantity,
      unit: item.unit,
      optional: item.optional
    })))
})

/**
 * No row is saved half-looked-up. Typing an ingredient and hitting Save in the
 * same breath used to send the line with no `food_id` behind it — the server
 * then weighed it as nothing, and the recipe came back reading zero, which is
 * exactly how this looked from the outside.
 */
async function settle() {
  for (const line of lines.value) {
    if (!line.label.trim()) {
      continue
    }
    const settled = line.food_id || choices.value.has(line.key) || missing.value.has(line.key)
    await (settled ? inflight.get(line.key) : (inflight.get(line.key) ?? resolveLine(line)))
  }
}

async function save() {
  const recipe = full.value
  if (!recipe || saving.value) {
    return
  }
  saving.value = true
  await pasteInFlight
  await settle()
  try {
    const updated = await updateRecipe(recipe.id, {
      title: form.title.trim() || recipe.title,
      subtitle: form.subtitle.trim() || null,
      minutes: form.minutes,
      servings: Number(form.servings) || 1,
      serving_unit: form.serving_unit,
      steps: form.steps.split('\n').map(step => step.trim()).filter(Boolean),
      note: form.note.trim() || null,
      items: itemsPayload.value
    })
    fill(updated)
    emit('saved', updated)

    // A row with no food behind it is saved as written and counts as nothing —
    // better said out loud than discovered as a recipe that adds up to zero
    const empty = (updated.items ?? []).filter(item => !item.food_id).map(item => item.label)
    if (empty.length) {
      toast.add({
        title: `${updated.title} saved`,
        description: `${empty.join(', ')} ${empty.length === 1 ? 'has' : 'have'} no food behind ${empty.length === 1 ? 'it' : 'them'}, so ${empty.length === 1 ? 'it counts' : 'they count'} as zero. Add ${empty.length === 1 ? 'it' : 'them'} in the Library under Foods.`,
        icon: 'i-lucide-triangle-alert',
        color: 'warning'
      })
    } else {
      toast.add({ title: `${updated.title} saved`, icon: 'i-lucide-book-check', color: 'success' })
    }
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}

// --- Onto a day ------------------------------------------------------------------

const today = useToday()
const planning = ref(false)
const plan = reactive({
  day: today.value,
  at: '',
  servings: 1
})
/** A date field cleared on a phone holds "", and an iPhone offers next week */
const planError = computed(() => dayRefusal(plan.day, today.value))

function startPlanning() {
  plan.day = today.value
  plan.at = ''
  plan.servings = 1
  planning.value = true
}

async function addToDiary() {
  const recipe = full.value
  if (!recipe || adding.value || planError.value) {
    return
  }
  adding.value = true
  try {
    const meal = await mealFromRecipe({
      recipe_id: recipe.id,
      day: plan.day,
      at: plan.at || null,
      servings: Number(plan.servings) || 1
    })
    emit('added', meal)
    planning.value = false
    open.value = false
    toast.add({
      title: `${recipe.title} on ${dayLabel(plan.day, today.value)}`,
      icon: 'i-lucide-utensils',
      color: 'success'
    })
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    adding.value = false
  }
}

// --- Away for good -------------------------------------------------------------

const removing = ref(false)

async function remove() {
  const recipe = full.value
  if (!recipe || removing.value) {
    return
  }
  const sure = await confirm({
    title: `Delete ${recipe.title}?`,
    description: 'Meals already cooked from it stay in the diary as they are.',
    confirmLabel: 'Delete',
    color: 'error'
  })
  if (!sure) {
    return
  }
  removing.value = true
  try {
    await removeRecipe(recipe.id)
    emit('removed', recipe)
    open.value = false
    toast.add({ title: `${recipe.title} deleted`, icon: 'i-lucide-trash-2', color: 'success' })
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    removing.value = false
  }
}

// The ingredients read the way Today reads an open meal: the name across
// with "optional" and ✕ at the end, then amount · unit · its weight
const LINE_COLS = 'grid items-center gap-x-2 gap-y-1 grid-cols-[3.75rem_6rem_minmax(0,1fr)_2rem_2rem]'

const AMOUNT_UI = { base: 'tabular-nums px-2 text-right' }

/** A list inside the sheet: a group of rows with hairlines, no card around it */
const GROUP = 'app-card app-divide flex flex-col overflow-hidden'
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="full?.title ?? recipe?.title ?? 'Recipe'"
    :description="full?.subtitle ?? recipe?.subtitle ?? undefined"
    :ui="SHEET_UI"
  >
    <template #body>
      <div
        v-if="full"
        class="flex flex-col gap-5"
      >
        <!-- What it comes to, and what was stated for it -->
        <div class="app-card flex flex-col gap-3 p-4">
          <div class="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span class="flex items-baseline gap-1.5">
              <span class="font-rounded text-[2.125rem] leading-none font-bold text-highlighted tabular-nums">{{ formatKcal(shown?.kcal ?? full.kcal) }}</span>
              <span class="text-subheadline text-muted">kcal</span>
            </span>
            <span class="pb-0.5 text-footnote text-muted">for {{ servingsLabel(full) }}</span>
            <span
              v-if="statedOnly"
              class="pb-0.5 text-footnote text-muted"
            >· as stated</span>
            <span
              v-if="gap && full.stated && !statedOnly"
              class="ml-auto pb-0.5 text-footnote font-medium text-warning tabular-nums"
              :aria-label="`Stated as ${formatKcal(full.stated.kcal)} kcal; the ingredients add up to ${formatKcal(full.kcal)}`"
            >stated {{ formatKcal(full.stated.kcal) }}</span>
          </div>
          <p
            v-if="each && full.servings > 1"
            class="-mt-1 text-subheadline text-default tabular-nums"
          >
            {{ formatKcal(each.kcal) }} kcal per {{ full.serving_unit }}
          </p>
          <div class="app-rule-t -mx-4 grid grid-cols-3 gap-3 px-4 pt-3">
            <span
              v-for="bar in summary"
              :key="bar.key"
              class="flex min-w-0 flex-col"
            >
              <span class="flex items-center gap-1.5 text-caption text-muted">
                <span
                  class="size-2 shrink-0 rounded-full"
                  :class="bar.dot"
                />
                {{ bar.label }}
              </span>
              <span class="text-subheadline font-medium text-highlighted tabular-nums">{{ formatMacro(bar.value) }} g</span>
              <span
                v-if="bar.per !== null"
                class="text-caption text-muted tabular-nums"
              >{{ formatMacro(bar.per) }} g each</span>
            </span>
          </div>
        </div>

        <!-- Onto a day — right where the eye is when the button is pressed -->
        <div
          v-if="planning"
          class="app-card grid grid-cols-2 gap-3 p-4"
        >
          <span class="col-span-2 text-headline text-highlighted">Put it on a day</span>
          <UFormField
            label="Day"
            :error="planError ?? false"
          >
            <input
              v-model="plan.day"
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
              v-model="plan.at"
              type="time"
              class="app-field"
              aria-label="Time"
            >
          </UFormField>
          <UFormField
            :label="full.serving_unit === 'piece' ? 'Pieces' : 'Servings'"
            class="col-span-2"
          >
            <DecimalInput
              v-model="plan.servings"
              class="w-28"
              :ui="AMOUNT_UI"
            />
          </UFormField>
          <div class="col-span-2 flex gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              :disabled="adding"
              @click="planning = false"
            />
            <UButton
              label="Write it down"
              icon="i-lucide-check"
              class="flex-1 justify-center"
              :loading="adding"
              :disabled="Boolean(planError)"
              @click="addToDiary"
            />
          </div>
        </div>

        <!-- The recipe's own facts as one group, Health's way: each on a
             row, the value right-aligned against its unit -->
        <div :class="GROUP">
          <ShellFieldRow
            label="Title"
            wide
          >
            <UInput
              v-model="form.title"
              placeholder="Required"
              variant="none"
              :ui="FIELD_ROW_INPUT"
            />
          </ShellFieldRow>
          <ShellFieldRow
            label="Subtitle"
            wide
          >
            <UInput
              v-model="form.subtitle"
              placeholder="Optional"
              variant="none"
              :ui="FIELD_ROW_INPUT"
            />
          </ShellFieldRow>
          <ShellFieldRow
            label="Minutes"
            unit="min"
          >
            <UInput
              v-model.number="form.minutes"
              type="number"
              inputmode="numeric"
              min="0"
              step="5"
              placeholder="—"
              variant="none"
              :ui="FIELD_ROW_INPUT"
            />
          </ShellFieldRow>
          <!-- What the batch divides into. Twelve muffins are pieces; one
               pot of stew that feeds four is servings. -->
          <div class="flex min-h-11 min-w-0 items-center gap-3 px-4 py-1.5">
            <span class="min-w-0 flex-1 truncate text-body text-default">Makes</span>
            <DecimalInput
              v-model="form.servings"
              variant="none"
              class="w-12 shrink-0"
              :ui="FIELD_ROW_INPUT"
              aria-label="How many it makes"
            />
            <ShellSegmented
              v-model="form.serving_unit"
              label="What it divides into"
              size="sm"
              :options="SERVING_UNITS.map(unit => ({ value: unit.value, label: unit.label }))"
              class="w-44 shrink-0"
            />
          </div>
        </div>

        <!-- Ingredients, edited where they stand -->
        <section
          class="flex flex-col gap-1.5"
          aria-labelledby="recipe-ingredients"
        >
          <div class="flex items-center gap-1 pl-4">
            <h3
              id="recipe-ingredients"
              class="app-group-title tabular-nums"
            >
              Ingredients · {{ lines.length }}
            </h3>
            <UButton
              label="Paste"
              icon="i-lucide-clipboard-list"
              size="sm"
              :variant="pasting ? 'soft' : 'ghost'"
              class="ml-auto"
              :aria-pressed="pasting"
              @click="pasting = !pasting"
            />
            <UButton
              label="Add"
              icon="i-lucide-plus"
              size="sm"
              variant="ghost"
              @click="addLine"
            />
          </div>

          <!-- One line in, the rows out — the same parser the diary uses -->
          <form
            v-if="pasting"
            class="flex items-center gap-2"
            @submit.prevent="readPasted"
          >
            <UInput
              v-model="pasted"
              autofocus
              placeholder="8 eggs, 220g cottage cheese, 70g ham"
              class="min-w-0 flex-1"
              aria-label="The whole ingredient list"
            />
            <UButton
              label="Read"
              icon="i-lucide-text-search"
              type="submit"
              variant="soft"
              :loading="reading"
              :disabled="!pasted.trim()"
            />
          </form>

          <div :class="GROUP">
            <div
              v-for="line in lines"
              :key="line.key"
              class="px-3 py-2.5"
              :class="LINE_COLS"
            >
              <UInput
                v-model="line.label"
                variant="none"
                placeholder="Ingredient"
                class="col-span-3 min-w-0"
                :ui="{ root: 'w-full', base: 'px-1 py-1 text-body text-highlighted' }"
                aria-label="Ingredient"
                @blur="resolveLine(line)"
                @keydown.enter="resolveLine(line)"
              />
              <UButton
                :icon="line.optional ? 'i-lucide-circle-dashed' : 'i-lucide-circle'"
                size="sm"
                color="neutral"
                variant="ghost"
                square
                class="app-hit"
                :class="line.optional ? 'text-warning' : 'text-dimmed'"
                :aria-label="line.optional ? 'Optional — make it required' : 'Required — make it optional'"
                :aria-pressed="line.optional"
                @click="line.optional = !line.optional"
              />
              <UButton
                icon="i-lucide-x"
                size="sm"
                color="neutral"
                variant="ghost"
                square
                class="app-hit text-dimmed"
                :aria-label="`Remove ${line.label}`"
                @click="dropLine(line.key)"
              />
              <DecimalInput
                v-model="line.quantity"
                size="sm"
                class="w-full"
                :ui="AMOUNT_UI"
                :aria-label="`Amount of ${line.label || 'the ingredient'}`"
                @change="weigh(line)"
              />
              <USelect
                v-model="line.unit"
                :items="unitItemsFor(line.unit)"
                value-key="value"
                size="sm"
                class="w-full"
                :aria-label="`Unit for ${line.label || 'the ingredient'}`"
                @update:model-value="weigh(line)"
              />
              <!-- Either the row found its food, or it asks which one -->
              <span class="col-span-3 flex min-w-0 flex-wrap items-center justify-end gap-1 text-right text-caption tabular-nums">
                <UIcon
                  v-if="looking.has(line.key)"
                  name="i-lucide-loader-circle"
                  class="size-3.5 animate-spin text-dimmed"
                />
                <span
                  v-else-if="missing.has(line.key)"
                  class="text-warning"
                >not in your foods — add it in the Library</span>
                <template v-else-if="choices.get(line.key)?.length">
                  <span class="text-dimmed">which?</span>
                  <button
                    v-for="food in choices.get(line.key)"
                    :key="food.id"
                    type="button"
                    class="app-chip h-7 px-2.5 text-footnote"
                    @click="pick(line, food)"
                  >
                    {{ food.name }}
                  </button>
                </template>
                <span
                  v-else
                  class="text-dimmed"
                >
                  <template v-if="line.grams">{{ formatGrams(line.grams) }}</template>
                  <template v-if="line.optional">{{ line.grams ? ' · ' : '' }}optional</template>
                </span>
              </span>
            </div>

            <p
              v-if="!lines.length"
              class="px-4 py-3.5 text-subheadline text-muted"
            >
              No ingredients yet — add the first line, or paste the whole list.
            </p>
          </div>
        </section>

        <!-- Steps read as steps; the textarea is one tap away -->
        <section
          class="flex flex-col gap-1.5"
          aria-labelledby="recipe-steps"
        >
          <div class="flex min-h-8 items-center gap-1 pl-4">
            <h3
              id="recipe-steps"
              class="app-group-title tabular-nums"
            >
              Steps<template v-if="stepList.length">
                · {{ stepList.length }}
              </template>
            </h3>
            <UButton
              v-if="stepList.length"
              :label="editingSteps ? 'Done' : 'Edit'"
              :icon="editingSteps ? 'i-lucide-check' : 'i-lucide-pencil-line'"
              size="sm"
              variant="ghost"
              class="ml-auto"
              @click="editingSteps = !editingSteps"
            />
          </div>

          <UTextarea
            v-if="editingSteps || !stepList.length"
            v-model="form.steps"
            :rows="4"
            autoresize
            class="w-full"
            placeholder="One step per line — heat the pan…"
            aria-label="Steps, one per line"
          />
          <ol
            v-else
            class="app-card flex flex-col gap-3 px-4 py-3.5"
          >
            <li
              v-for="(step, index) in stepList"
              :key="index"
              class="flex gap-3 text-body leading-relaxed text-default"
            >
              <span class="w-5 shrink-0 text-right font-semibold text-muted tabular-nums">{{ index + 1 }}</span>
              <span class="min-w-0">{{ step }}</span>
            </li>
          </ol>
        </section>

        <!-- A group of its own, headed like Ingredients and Steps above it -->
        <div class="flex flex-col gap-1.5">
          <p class="app-group-title px-4">
            Note
          </p>
          <UTextarea
            v-model="form.note"
            :rows="2"
            autoresize
            placeholder="Optional"
            aria-label="Note"
            class="w-full"
          />
        </div>
      </div>

      <div
        v-else
        class="flex flex-col gap-4"
      >
        <ShellSkeleton
          variant="card"
          :count="2"
        />
        <ShellSkeleton
          variant="rows"
          :count="3"
          :class="GROUP"
        />
      </div>
    </template>

    <!-- Only ever one obvious action: with edits pending it is saving them,
         otherwise it is putting this on a day -->
    <template #footer>
      <div class="flex w-full items-center gap-2">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          square
          :loading="removing"
          :disabled="!full"
          aria-label="Delete the recipe"
          @click="remove"
        />
        <span
          v-if="dirty"
          class="flex items-center gap-1 text-footnote font-medium text-warning"
        >
          <span class="size-1.5 rounded-full bg-warning" />
          Unsaved
        </span>
        <div class="ml-auto flex gap-2">
          <UButton
            label="Add to diary"
            icon="i-lucide-calendar-plus"
            :color="dirty ? 'neutral' : 'primary'"
            :variant="dirty || planning ? 'soft' : 'solid'"
            :disabled="!full"
            @click="startPlanning"
          />
          <UButton
            label="Save"
            :color="dirty ? 'primary' : 'neutral'"
            :variant="dirty ? 'solid' : 'soft'"
            :loading="saving"
            :disabled="!full || !form.title.trim()"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UDrawer>
</template>
