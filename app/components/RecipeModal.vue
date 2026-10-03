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

async function readPasted() {
  const text = pasted.value.trim()
  if (!text || reading.value) {
    return
  }
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

const planning = ref(false)
const plan = reactive({
  day: localIsoDay(),
  at: '',
  servings: 1
})

function startPlanning() {
  plan.day = localIsoDay()
  plan.at = ''
  plan.servings = 1
  planning.value = true
}

async function addToDiary() {
  const recipe = full.value
  if (!recipe || adding.value) {
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
      title: `${recipe.title} on ${dayLabel(plan.day)}`,
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

const NATIVE_INPUT = 'w-full rounded-md border border-default bg-default px-2 py-1.5 text-sm tabular-nums text-default focus:outline-primary'

// The ingredients are a sheet like everything else: amount, unit, ingredient;
// the weight sits under the name, where a phone has room for it
const LINE_COLS = 'grid items-center gap-x-2 grid-cols-[3.25rem_4.5rem_minmax(0,1fr)_1.75rem_1.75rem]'

const AMOUNT_UI = { base: 'tabular-nums px-1.5 text-right' }
const UNIT_UI = { base: 'px-1.5' }
</script>

<template>
  <UModal
    v-model:open="open"
    :title="full?.title ?? recipe?.title ?? 'Recipe'"
    :description="full?.subtitle ?? recipe?.subtitle ?? undefined"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div
        v-if="full"
        class="flex flex-col gap-4"
      >
        <!-- What it comes to, and what was stated for it -->
        <div class="flex flex-col gap-2 rounded-lg bg-elevated/50 px-3 py-2">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="text-xl font-semibold leading-none tabular-nums text-emerald-500">{{ formatKcal(shown?.kcal ?? full.kcal) }}</span>
            <span class="text-xs font-medium text-muted">kcal · {{ servingsLabel(full) }}</span>
            <span
              v-if="statedOnly"
              class="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-dimmed"
            >as stated</span>
            <span
              v-if="each && full.servings > 1"
              class="text-[11px] tabular-nums text-dimmed"
            >{{ formatKcal(each.kcal) }} kcal per {{ full.serving_unit }}</span>
            <span
              v-if="gap && full.stated && !statedOnly"
              class="ml-auto rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-warning"
              :aria-label="`Stated as ${formatKcal(full.stated.kcal)} kcal; the ingredients add up to ${formatKcal(full.kcal)}`"
            >stated {{ formatKcal(full.stated.kcal) }}</span>
          </div>
          <div class="grid grid-cols-3 gap-x-3">
            <span
              v-for="bar in summary"
              :key="bar.key"
              class="flex flex-col text-[11px]"
            >
              <span class="flex items-center gap-1.5 text-default">
                <span
                  class="size-2 shrink-0 rounded-full"
                  :class="bar.dot"
                />
                {{ bar.label }}
              </span>
              <span class="tabular-nums text-muted">
                {{ formatMacro(bar.value) }} g<span
                  v-if="bar.per !== null"
                  class="text-dimmed"
                > · {{ formatMacro(bar.per) }} each</span>
              </span>
            </span>
          </div>
        </div>

        <!-- Onto a day — right where the eye is when the button is pressed -->
        <div
          v-if="planning"
          class="grid grid-cols-2 gap-3 rounded-lg bg-primary/5 p-3 ring-1 ring-primary/20 ring-inset"
        >
          <span class="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-primary">Put it on a day</span>
          <UFormField label="Day">
            <input
              v-model="plan.day"
              type="date"
              :class="NATIVE_INPUT"
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
              :class="NATIVE_INPUT"
              aria-label="Time"
            >
          </UFormField>
          <UFormField :label="full.serving_unit === 'piece' ? 'Pieces' : 'Servings'">
            <UInput
              v-model.number="plan.servings"
              type="number"
              inputmode="decimal"
              min="0.25"
              step="0.25"
              class="w-full"
              :ui="AMOUNT_UI"
            />
          </UFormField>
          <div class="flex items-end justify-end gap-2">
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
              :loading="adding"
              @click="addToDiary"
            />
          </div>
        </div>

        <UFormField label="Title">
          <UInput
            v-model="form.title"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Subtitle"
          hint="optional"
        >
          <UInput
            v-model="form.subtitle"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-[6rem_minmax(0,1fr)] items-end gap-3">
          <UFormField label="Minutes">
            <UInput
              v-model.number="form.minutes"
              type="number"
              inputmode="numeric"
              min="0"
              step="5"
              placeholder="—"
              class="w-full"
              :ui="{ base: 'tabular-nums' }"
            />
          </UFormField>
          <UFormField :label="form.serving_unit === 'piece' ? 'Makes (pieces)' : 'Makes (servings)'">
            <div class="flex items-center gap-2">
              <UInput
                v-model.number="form.servings"
                type="number"
                inputmode="decimal"
                min="1"
                step="1"
                class="w-20"
                :ui="{ base: 'tabular-nums' }"
              />
              <!-- What the batch divides into. Twelve muffins are pieces; one
                   pot of stew that feeds four is servings. -->
              <div class="flex items-center gap-0.5 rounded-lg bg-elevated/70 p-0.5">
                <button
                  v-for="unit in SERVING_UNITS"
                  :key="unit.value"
                  type="button"
                  class="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                  :class="form.serving_unit === unit.value
                    ? 'bg-default text-highlighted shadow-sm'
                    : 'text-muted hover:text-default'"
                  :aria-pressed="form.serving_unit === unit.value"
                  :aria-label="unit.hint"
                  @click="form.serving_unit = unit.value"
                >
                  {{ unit.label }}
                </button>
              </div>
            </div>
          </UFormField>
        </div>

        <!-- Ingredients, as an editable sheet -->
        <div class="flex flex-col overflow-hidden rounded-lg border border-default">
          <div class="flex items-center gap-2 bg-elevated/50 px-3 py-1.5">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-dimmed">Ingredients</span>
            <span class="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold tabular-nums text-default">{{ lines.length }}</span>
            <UButton
              label="Paste"
              icon="i-lucide-clipboard-list"
              size="xs"
              color="neutral"
              variant="ghost"
              class="ml-auto"
              @click="pasting = !pasting"
            />
            <UButton
              label="Add"
              icon="i-lucide-plus"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="addLine"
            />
          </div>

          <!-- One line in, the rows out — the same parser the diary uses -->
          <form
            v-if="pasting"
            class="flex items-center gap-2 border-t border-default bg-elevated/30 px-3 py-2"
            @submit.prevent="readPasted"
          >
            <UInput
              v-model="pasted"
              size="sm"
              autofocus
              placeholder="8 eggs, 220g cottage cheese, 70g ham"
              class="min-w-0 flex-1"
              :ui="{ root: 'w-full' }"
              aria-label="The whole ingredient list"
            />
            <UButton
              label="Read"
              icon="i-lucide-wand-sparkles"
              size="sm"
              type="submit"
              :loading="reading"
              :disabled="!pasted.trim()"
            />
          </form>

          <div
            v-for="line in lines"
            :key="line.key"
            class="border-t border-default px-3 py-1.5"
            :class="LINE_COLS"
          >
            <UInput
              v-model.number="line.quantity"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.1"
              size="xs"
              class="w-full"
              :ui="AMOUNT_UI"
              :aria-label="`Amount of ${line.label || 'the ingredient'}`"
              @change="weigh(line)"
            />
            <USelect
              v-model="line.unit"
              :items="unitItemsFor(line.unit)"
              value-key="value"
              size="xs"
              class="w-full"
              :ui="UNIT_UI"
              :aria-label="`Unit for ${line.label || 'the ingredient'}`"
              @update:model-value="weigh(line)"
            />
            <span class="flex min-w-0 flex-col">
              <UInput
                v-model="line.label"
                size="xs"
                variant="none"
                placeholder="Ingredient"
                class="w-full"
                :ui="{ root: 'w-full', base: 'px-0 text-sm text-highlighted' }"
                aria-label="Ingredient"
                @blur="resolveLine(line)"
                @keydown.enter="resolveLine(line)"
              />
              <!-- Either the row found its food, or it asks which one -->
              <span class="flex flex-wrap items-center gap-1 text-[11px] tabular-nums">
                <UIcon
                  v-if="looking.has(line.key)"
                  name="i-lucide-loader-circle"
                  class="size-3 animate-spin text-dimmed"
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
                    class="rounded-md bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-default transition-colors hover:text-highlighted"
                    @click="pick(line, food)"
                  >{{ food.name }}</button>
                </template>
                <span
                  v-else
                  class="text-dimmed"
                >
                  <template v-if="line.grams">{{ formatGrams(line.grams) }}</template>
                  <template v-if="line.optional">{{ line.grams ? ' · ' : '' }}optional</template>
                </span>
              </span>
            </span>
            <UButton
              :icon="line.optional ? 'i-lucide-circle-dashed' : 'i-lucide-circle'"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              :class="line.optional ? 'text-warning' : 'text-dimmed'"
              :aria-label="line.optional ? 'Optional — make it required' : 'Required — make it optional'"
              @click="line.optional = !line.optional"
            />
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              class="text-dimmed hover:text-error"
              :aria-label="`Remove ${line.label}`"
              @click="dropLine(line.key)"
            />
          </div>

          <p
            v-if="!lines.length"
            class="border-t border-default px-3 py-3 text-xs text-muted"
          >
            No ingredients yet — add the first line, or paste the whole list.
          </p>
        </div>

        <!-- Steps read as steps; the textarea is one tap away -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-dimmed">Steps</span>
            <span
              v-if="stepList.length"
              class="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold tabular-nums text-default"
            >{{ stepList.length }}</span>
            <UButton
              v-if="stepList.length"
              :label="editingSteps ? 'Done' : 'Edit'"
              :icon="editingSteps ? 'i-lucide-check' : 'i-lucide-pencil-line'"
              size="xs"
              color="neutral"
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
            class="flex flex-col gap-1.5"
          >
            <li
              v-for="(step, index) in stepList"
              :key="index"
              class="flex gap-2.5 text-sm leading-relaxed text-default"
            >
              <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-elevated text-[11px] font-semibold tabular-nums text-muted">{{ index + 1 }}</span>
              <span class="min-w-0">{{ step }}</span>
            </li>
          </ol>
        </div>

        <UFormField
          label="Note"
          hint="optional"
        >
          <UTextarea
            v-model="form.note"
            :rows="2"
            class="w-full"
          />
        </UFormField>
      </div>

      <div
        v-else
        class="flex flex-col gap-2"
      >
        <USkeleton class="h-4 w-2/3" />
        <USkeleton class="h-4 w-1/2" />
      </div>
    </template>

    <!-- Only ever one obvious action: with edits pending it is saving them,
         otherwise it is putting this on a day -->
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
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
          class="flex items-center gap-1.5 text-[11px] text-warning"
        >
          <UIcon
            name="i-lucide-pencil-line"
            class="size-3.5"
          />
          Unsaved
        </span>
        <div class="ml-auto flex gap-2">
          <UButton
            label="Add to diary"
            icon="i-lucide-calendar-plus"
            :color="dirty ? 'neutral' : 'primary'"
            :variant="dirty || planning ? 'subtle' : 'solid'"
            :disabled="!full"
            @click="startPlanning"
          />
          <UButton
            label="Save"
            icon="i-lucide-save"
            :color="dirty ? 'primary' : 'neutral'"
            :variant="dirty ? 'solid' : 'subtle'"
            :loading="saving"
            :disabled="!full || !form.title.trim()"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
