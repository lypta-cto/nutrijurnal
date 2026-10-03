<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DayTotals, Meal, MealItem, Targets } from '~/composables/useEating'
import {
  ITEM_COLUMNS,
  MEAL_COLUMNS,
  dayLabel,
  dayShort,
  formatGrams,
  formatKcal,
  formatMacro,
  itemPayload,
  shiftDay,
  targetsOf,
  timeLabel,
  unitItemsFor
} from '~/composables/useEating'

/**
 * Today — the diary, one day at a time: the day's meals as rows, each one
 * opening onto the items it is made of, every item editable where it
 * stands. Above them the week strip (seven days against the target) and the
 * day's scoreboard.
 *
 * Food names come from the data and are shown exactly as they are; everything
 * the app itself says is English.
 */
const {
  settings,
  day,
  meals,
  totals,
  target,
  loading,
  loadSettings,
  loadDay,
  loadWeek,
  saveSettings,
  addItem,
  updateItem,
  removeItem,
  updateMeal,
  removeMeal,
  addMeal,
  parseText,
  exportFile
} = useEating()

const quickAdd = useQuickAdd()
const toast = useToast()
const { confirm } = useConfirm()

const today = computed(() => localIsoDay())
const strip = ref<DayTotals[]>([])
/** Which meals stand open; a new day folds them all back up */
const expanded = ref(new Set<string>())

async function refreshWeek() {
  strip.value = await loadWeek(day.value)
}

async function refreshAll() {
  await Promise.all([
    loadDay().catch(() => {}),
    refreshWeek().catch(() => {})
  ])
}

onMounted(async () => {
  await loadSettings().catch(() => {})
  await refreshAll()
})

watch(day, async () => {
  expanded.value = new Set()
  await refreshAll()
})

// Something was written down through the "+" sheet — show it
watch(quickAdd.savedAt, () => void refreshAll())

// --- The day -----------------------------------------------------------------

function move(delta: number) {
  day.value = shiftDay(day.value, delta)
}

const weekDays = computed(() =>
  strip.value.map(entry => ({
    ...entry,
    label: new Date(`${entry.day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'narrow' }),
    date: new Date(`${entry.day}T12:00:00`).getDate(),
    isToday: entry.day === today.value,
    // Within the target is emerald, past it amber — an empty day says nothing
    tone: !entry.meals
      ? 'bg-elevated'
      : !target.value?.kcal
          ? 'bg-accented'
          : entry.kcal > target.value.kcal ? 'bg-amber-500' : 'bg-emerald-500'
  }))
)

// --- Rows ---------------------------------------------------------------------

function isOpen(meal: Meal): boolean {
  return expanded.value.has(meal.id)
}

function toggle(meal: Meal) {
  const next = new Set(expanded.value)
  if (next.has(meal.id)) {
    next.delete(meal.id)
  } else {
    next.add(meal.id)
  }
  expanded.value = next
}

/**
 * Where a meal stands, as one fixed pill: counted is emerald with a check,
 * written-down-but-not-counted is the amber invitation to fill it in.
 */
function mealState(meal: Meal): { counted: boolean, label: string, icon: string, tone: string, title: string } {
  if (meal.items.length) {
    return {
      counted: true,
      label: String(meal.items.length),
      icon: 'i-lucide-check',
      tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      title: `${meal.items.length} ${meal.items.length === 1 ? 'item' : 'items'} counted`
    }
  }
  return {
    counted: false,
    label: 'Fill in',
    icon: 'i-lucide-pencil-line',
    tone: 'bg-amber-400/15 text-warning hover:bg-amber-400/25',
    title: 'Written down, not counted yet — put the amounts in'
  }
}

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

// --- Items, edited where they stand ---------------------------------------------

const busyItem = ref<string | null>(null)
/** What a line looked like when it was focused — nothing is sent unchanged */
const snapshots = new Map<string, string>()

function fingerprint(item: MealItem): string {
  return `${item.quantity}|${item.unit}|${item.label.trim()}`
}

function remember(item: MealItem) {
  snapshots.set(item.id, fingerprint(item))
}

/** The row already shows the new amount — this is what sends it */
async function commitItem(meal: Meal, item: MealItem, force = false) {
  if (busyItem.value === item.id) {
    return
  }
  if (!force && snapshots.get(item.id) === fingerprint(item)) {
    return
  }
  busyItem.value = item.id
  try {
    await updateItem(meal.id, item.id, {
      quantity: Number(item.quantity) || 0,
      unit: item.unit,
      label: item.label.trim() || 'Item'
    })
    void refreshWeek()
  } catch (error) {
    fail(error)
    await loadDay().catch(() => {})
  } finally {
    busyItem.value = null
    snapshots.delete(item.id)
  }
}

async function dropItem(meal: Meal, item: MealItem) {
  try {
    await removeItem(meal.id, item.id)
    void refreshWeek()
  } catch (error) {
    fail(error)
  }
}

// One line, typed the way the meal was: "30g almonds, 1 banana"
const addText = ref<Record<string, string>>({})
const addingTo = ref<string | null>(null)

async function addLine(meal: Meal) {
  const text = (addText.value[meal.id] ?? '').trim()
  if (!text || addingTo.value) {
    return
  }
  addingTo.value = meal.id
  try {
    const parsed = await parseText(text)
    for (const entry of parsed.items) {
      await addItem(meal.id, {
        food_id: entry.food_id,
        label: entry.label,
        quantity: entry.quantity,
        unit: entry.unit
      })
    }
    // Nothing was recognised — the words are kept rather than lost
    if (!parsed.items.length) {
      await addItem(meal.id, { label: text, quantity: 1, unit: 'piece' })
    }
    if (parsed.unknown.length) {
      toast.add({
        title: `Not recognised: ${parsed.unknown.join(', ')}`,
        description: 'Add it as a food in the Library, then type it again.',
        icon: 'i-lucide-circle-help',
        color: 'warning'
      })
    }
    addText.value[meal.id] = ''
    void refreshWeek()
  } catch (error) {
    fail(error)
  } finally {
    addingTo.value = null
  }
}

// --- Meal actions ----------------------------------------------------------------

const moveOpen = ref(false)
const moving = ref<Meal | null>(null)
const moveDay = ref(localIsoDay())

function askMove(meal: Meal) {
  moving.value = meal
  moveDay.value = meal.day
  moveOpen.value = true
}

async function doMove() {
  const meal = moving.value
  if (!meal || moveDay.value === meal.day) {
    moveOpen.value = false
    return
  }
  try {
    await updateMeal(meal.id, { day: moveDay.value })
    toast.add({ title: `Moved to ${dayLabel(moveDay.value)}`, icon: 'i-lucide-calendar-check', color: 'success' })
    moveOpen.value = false
    void refreshWeek()
  } catch (error) {
    fail(error)
  }
}

/** The same plate again, on today — written as a new meal, not a link */
async function duplicate(meal: Meal) {
  try {
    const copy = await addMeal({
      day: today.value,
      at: meal.at,
      title: meal.title,
      note: meal.note,
      items: meal.items.map(itemPayload)
    })
    toast.add({ title: `${copy.title} copied to today`, icon: 'i-lucide-copy-check', color: 'success' })
    if (day.value !== today.value) {
      day.value = today.value
    } else {
      void refreshWeek()
    }
  } catch (error) {
    fail(error)
  }
}

async function confirmDelete(meal: Meal) {
  const confirmed = await confirm({
    title: 'Delete this meal?',
    description: `“${meal.title}” and its ${meal.items.length} ${meal.items.length === 1 ? 'item' : 'items'} leave the day.`,
    confirmLabel: 'Delete',
    color: 'error'
  })
  if (!confirmed) {
    return
  }
  try {
    await removeMeal(meal.id)
    void refreshWeek()
  } catch (error) {
    fail(error)
  }
}

function mealMenu(meal: Meal): DropdownMenuItem[][] {
  return [[
    { label: 'Edit', icon: 'i-lucide-pencil-line', onSelect: () => fillIn(meal) },
    { label: 'Copy to today', icon: 'i-lucide-copy', onSelect: () => void duplicate(meal) },
    { label: 'Move to another day…', icon: 'i-lucide-calendar-days', onSelect: () => askMove(meal) }
  ], [
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => void confirmDelete(meal) }
  ]]
}

// --- Targets -----------------------------------------------------------------------

const targetsOpen = ref(false)
const savingTargets = ref(false)
const targets = ref<Targets>(targetsOf(null))

function openTargets() {
  targets.value = targetsOf(settings.value)
  targetsOpen.value = true
}

async function storeTargets() {
  savingTargets.value = true
  try {
    await saveSettings({ ...targets.value })
    await loadDay().catch(() => {})
    targetsOpen.value = false
    toast.add({ title: 'Targets saved', icon: 'i-lucide-target', color: 'success' })
  } catch (error) {
    fail(error)
  } finally {
    savingTargets.value = false
  }
}

const menuItems = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Daily targets…', icon: 'i-lucide-target', onSelect: () => openTargets() },
  { label: 'Export the diary…', icon: 'i-lucide-download', onSelect: () => { exportOpen.value = true } }
]])

// --- Export -------------------------------------------------------------------------

const exportOpen = ref(false)
const exporting = ref(false)
type Period = 'day' | 'week' | 'month' | '30d' | 'custom'
type Preset = Exclude<Period, 'custom'>

const PERIODS: { value: Preset, label: string }[] = [
  { value: 'day', label: 'This day' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' }
]

/** What the backend will hand over in one file; past this it answers 400 */
const MAX_EXPORT_DAYS = 400

const period = ref<Period>('week')
const customFrom = ref('')
const customTo = ref('')

function presetRange(which: Preset, to: string): { from: string, to: string } {
  if (which === 'day') {
    return { from: to, to }
  }
  if (which === 'week') {
    return { from: shiftDay(to, -6), to }
  }
  if (which === '30d') {
    return { from: shiftDay(to, -29), to }
  }
  return { from: `${to.slice(0, 7)}-01`, to }
}

const range = computed<{ from: string, to: string }>(() =>
  period.value === 'custom'
    ? { from: customFrom.value, to: customTo.value }
    : presetRange(period.value, day.value))

// Custom opens on whatever period was showing, so the dates are already sane
// and only the edge that matters needs moving. Typed dates are left alone.
watch(period, (now, before) => {
  if (now !== 'custom' || before === 'custom' || (customFrom.value && customTo.value)) {
    return
  }
  const seed = presetRange(before, day.value)
  customFrom.value = customFrom.value || seed.from
  customTo.value = customTo.value || seed.to
})

/** Both ends counted, the way a person counts days off a calendar */
const rangeDays = computed(() => {
  const { from, to } = range.value
  if (!from || !to) {
    return null
  }
  const span = new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()
  return Math.round(span / 86_400_000) + 1
})

/** Said before the download, not after a 400 comes back */
const rangeProblem = computed<string | null>(() => {
  if (period.value !== 'custom') {
    return null
  }
  if (!customFrom.value || !customTo.value) {
    return 'Pick both dates.'
  }
  const days = rangeDays.value
  if (days === null || days < 1) {
    return 'The first date is after the last one.'
  }
  if (days > MAX_EXPORT_DAYS) {
    return `That is ${days} days — ${MAX_EXPORT_DAYS} is the most in one file.`
  }
  return null
})

async function download(format: 'pdf' | 'csv') {
  if (rangeProblem.value || exporting.value) {
    return
  }
  exporting.value = true
  try {
    const blob = await exportFile(range.value.from, range.value.to, format)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nutrijurnal_${range.value.from}_${range.value.to}.${format}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    exportOpen.value = false
  } catch (error) {
    fail(error)
  } finally {
    exporting.value = false
  }
}

// --- Filling in a meal ----------------------------------------------------------------

const formOpen = ref(false)
// The meal being filled in or edited
const filling = ref<Meal | null>(null)

/** Open a meal: its words when nothing was counted, its details otherwise */
function fillIn(meal: Meal) {
  filling.value = meal
  formOpen.value = true
}

watch(formOpen, (open) => {
  if (!open) {
    filling.value = null
  }
})

/** A meal moved onto another day takes the page with it — nothing vanishes */
async function afterSaved(meal: Meal) {
  if (meal.day !== day.value) {
    day.value = meal.day
    return
  }
  await refreshAll()
}

const MEAL_ROW = `${MEAL_COLUMNS} px-4 py-2.5`
const ITEM_ROW = `${ITEM_COLUMNS} px-4 py-1`

const NATIVE_INPUT = 'rounded-md border border-default bg-default px-2 py-1.5 text-sm tabular-nums text-default focus:outline-primary'

const PERIOD_BUTTON = 'rounded-md px-2 py-2 text-center text-xs font-medium transition-colors'
</script>

<template>
  <AppPage title="Today">
    <template #heading>
      <!-- Back a day, the day itself (tap to pick one), forward a day -->
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          square
          aria-label="The day before"
          @click="move(-1)"
        />
        <label class="relative min-w-0 cursor-pointer">
          <span class="block truncate text-xl font-semibold text-highlighted">{{ dayLabel(day) }}</span>
          <input
            :value="day"
            type="date"
            :max="today"
            class="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Pick a day"
            @change="event => day = (event.target as HTMLInputElement).value || day"
          >
        </label>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          square
          :disabled="day >= today"
          aria-label="The day after"
          @click="move(1)"
        />
      </div>
    </template>

    <template #actions>
      <UButton
        v-if="day !== today"
        label="Today"
        size="sm"
        color="neutral"
        variant="subtle"
        @click="day = today"
      />
      <UDropdownMenu
        :items="menuItems"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          square
          aria-label="Targets and export"
        />
      </UDropdownMenu>
    </template>

    <!-- The week: seven days, each against the target. Today is ringed
         wherever it falls, the day being read is the raised one. -->
    <template #toolbar>
      <div class="flex items-stretch gap-0.5 rounded-xl bg-elevated/70 p-0.5">
        <button
          v-for="entry in weekDays"
          :key="entry.day"
          type="button"
          class="relative flex min-w-0 flex-1 flex-col items-center rounded-lg px-0.5 py-1 pb-2 leading-tight transition-colors"
          :class="[
            day === entry.day ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-default',
            entry.isToday && day !== entry.day ? 'ring-1 ring-inset ring-accented' : ''
          ]"
          :aria-label="`${dayLabel(entry.day)}: ${entry.meals ? `${formatKcal(entry.kcal)} kcal` : 'nothing written down'}`"
          :aria-pressed="day === entry.day"
          @click="day = entry.day"
        >
          <span class="text-[10px] font-medium">{{ entry.label }} <span class="tabular-nums text-dimmed">{{ entry.date }}</span></span>
          <span
            class="text-[11px] font-semibold tabular-nums"
            :class="entry.meals ? '' : 'text-dimmed'"
          >{{ entry.meals ? formatKcal(entry.kcal) : '—' }}</span>
          <span
            class="absolute inset-x-1.5 bottom-0.5 h-0.5 rounded-full"
            :class="entry.tone"
          />
        </button>
      </div>
    </template>

    <EatingScoreboard
      :totals="totals"
      :target="target"
      :meals="meals.length"
      :loading="loading"
      @targets="openTargets"
    />

    <SheetCard
      title="Meals"
      icon="i-lucide-utensils"
      :count="meals.length || null"
      :loading="loading"
      :is-empty="!meals.length"
      empty="Nothing written down for this day yet."
    >
      <template #actions>
        <UButton
          label="Add"
          icon="i-lucide-plus"
          size="xs"
          variant="soft"
          @click="quickAdd.open()"
        />
      </template>

      <div
        v-for="meal in meals"
        :key="meal.id"
      >
        <div :class="MEAL_ROW">
          <span class="rounded-md bg-elevated px-1 py-1 text-center text-xs font-semibold tabular-nums text-highlighted">{{ timeLabel(meal.at) }}</span>
          <button
            type="button"
            class="flex min-w-0 flex-col text-left"
            :aria-expanded="isOpen(meal)"
            @click="toggle(meal)"
          >
            <span class="truncate text-sm font-medium text-highlighted">{{ meal.title }}</span>
            <span class="flex gap-x-2 text-[11px] tabular-nums">
              <span class="text-sky-500">P {{ formatMacro(meal.protein) }}</span>
              <span class="text-violet-500">C {{ formatMacro(meal.carbs) }}</span>
              <span class="text-amber-500">F {{ formatMacro(meal.fat) }}</span>
              <span class="font-medium text-highlighted">{{ formatKcal(meal.kcal) }} kcal</span>
            </span>
          </button>
          <!-- Counted, or the invitation to count it -->
          <button
            type="button"
            class="inline-flex h-7 w-full items-center justify-center gap-1 rounded-md text-[11px] font-medium tabular-nums transition-colors"
            :class="mealState(meal).tone"
            :aria-label="mealState(meal).title"
            @click.stop="mealState(meal).counted ? toggle(meal) : fillIn(meal)"
          >
            <UIcon
              :name="mealState(meal).icon"
              class="size-3 shrink-0"
            />
            {{ mealState(meal).label }}
          </button>
          <UDropdownMenu
            :items="mealMenu(meal)"
            :content="{ align: 'end' }"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              class="text-dimmed"
              :aria-label="`More for ${meal.title}`"
            />
          </UDropdownMenu>
          <UButton
            :icon="isOpen(meal) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            size="xs"
            color="neutral"
            variant="ghost"
            square
            class="text-dimmed"
            :aria-label="isOpen(meal) ? `Close ${meal.title}` : `Open ${meal.title}`"
            @click="toggle(meal)"
          />
        </div>

        <!-- What the meal was made of — each line corrected where it stands -->
        <div
          class="grid transition-all duration-300 ease-out"
          :class="isOpen(meal) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
          <div
            class="overflow-hidden"
            :inert="!isOpen(meal)"
          >
            <div class="border-t border-default bg-elevated/30 py-1">
              <div
                v-for="item in meal.items"
                :key="item.id"
                :class="ITEM_ROW"
              >
                <UInput
                  v-model.number="item.quantity"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.1"
                  size="xs"
                  class="w-full"
                  :ui="{ base: 'tabular-nums px-1.5 text-right' }"
                  :aria-label="`Amount of ${item.label}`"
                  @focus="remember(item)"
                  @blur="commitItem(meal, item)"
                />
                <USelect
                  v-model="item.unit"
                  :items="unitItemsFor(item.unit)"
                  value-key="value"
                  size="xs"
                  class="w-full"
                  :ui="{ base: 'px-1.5' }"
                  :aria-label="`Unit for ${item.label}`"
                  @update:model-value="commitItem(meal, item, true)"
                />
                <span class="flex min-w-0 flex-col">
                  <UInput
                    v-model="item.label"
                    size="xs"
                    variant="none"
                    class="w-full"
                    :ui="{ root: 'w-full', base: 'px-0 text-sm text-default' }"
                    :aria-label="`Name of ${item.label}`"
                    @focus="remember(item)"
                    @blur="commitItem(meal, item)"
                  />
                  <span class="flex gap-x-2 text-[11px] tabular-nums">
                    <span class="text-sky-500">P {{ formatMacro(item.protein) }}</span>
                    <span class="text-violet-500">C {{ formatMacro(item.carbs) }}</span>
                    <span class="text-amber-500">F {{ formatMacro(item.fat) }}</span>
                    <span class="text-highlighted">{{ formatKcal(item.kcal) }}</span>
                    <span
                      v-if="item.unit !== 'serving'"
                      class="text-dimmed"
                    >{{ formatGrams(item.grams) }}</span>
                  </span>
                </span>
                <UButton
                  icon="i-lucide-x"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  class="text-dimmed hover:text-error"
                  :aria-label="`Remove ${item.label}`"
                  @click="dropItem(meal, item)"
                />
              </div>

              <!-- One more line onto the plate, typed the way the meal was -->
              <form
                class="flex items-center gap-2 px-4 pt-1.5"
                @submit.prevent="addLine(meal)"
              >
                <UInput
                  v-model="addText[meal.id]"
                  icon="i-lucide-plus"
                  size="sm"
                  class="min-w-0 flex-1"
                  placeholder="Add an item — “30 g almonds”"
                  :disabled="addingTo === meal.id"
                />
                <UButton
                  type="submit"
                  label="Add"
                  size="sm"
                  color="neutral"
                  variant="subtle"
                  :loading="addingTo === meal.id"
                  :disabled="!(addText[meal.id] ?? '').trim()"
                />
              </form>

              <p
                v-if="meal.note || meal.has_voice"
                class="flex flex-wrap items-start gap-1.5 px-4 pt-1.5 text-xs text-muted"
              >
                <UIcon
                  :name="meal.has_voice ? 'i-lucide-mic' : 'i-lucide-sticky-note'"
                  class="mt-0.5 size-3 shrink-0 text-dimmed"
                />
                <span
                  v-if="meal.note"
                  class="min-w-0"
                >{{ meal.note }}</span>
                <span
                  v-else
                  class="text-dimmed"
                >said out loud, not written down</span>
                <MealVoice
                  v-if="meal.has_voice"
                  :meal="meal"
                  @changed="afterSaved"
                />
              </p>
            </div>
          </div>
        </div>
      </div>
    </SheetCard>

    <!-- Onto another day -->
    <UModal
      v-model:open="moveOpen"
      title="Move the meal"
      :description="moving ? `“${moving.title}” goes to the day you pick.` : ''"
    >
      <template #body>
        <div class="flex items-center gap-2">
          <input
            v-model="moveDay"
            type="date"
            :class="NATIVE_INPUT"
            aria-label="The day to move it to"
          >
          <span class="text-sm text-muted">{{ dayLabel(moveDay) }}</span>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="moveOpen = false"
          />
          <UButton
            label="Move"
            icon="i-lucide-calendar-check"
            @click="doMove"
          />
        </div>
      </template>
    </UModal>

    <!-- The day's targets -->
    <UModal
      v-model:open="targetsOpen"
      title="Daily targets"
      description="What a day should come to. Leave one empty and the diary simply counts it."
    >
      <template #body>
        <TargetsFields v-model="targets" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="savingTargets"
            @click="targetsOpen = false"
          />
          <UButton
            label="Save targets"
            :loading="savingTargets"
            @click="storeTargets"
          />
        </div>
      </template>
    </UModal>

    <!-- The diary for a period, as a file -->
    <UModal
      v-model:open="exportOpen"
      title="Export the diary"
      description="A period, day by day — a PDF to print or a CSV for a spreadsheet."
    >
      <template #body>
        <div class="flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-1">
            <button
              v-for="entry in PERIODS"
              :key="entry.value"
              type="button"
              :class="[PERIOD_BUTTON, period === entry.value ? 'bg-primary/10 text-primary' : 'bg-elevated/60 text-muted hover:text-default']"
              @click="period = entry.value"
            >
              {{ entry.label }}
            </button>
            <button
              type="button"
              class="col-span-2 flex items-center justify-center gap-1"
              :class="[PERIOD_BUTTON, period === 'custom' ? 'bg-primary/10 text-primary' : 'bg-elevated/60 text-muted hover:text-default']"
              @click="period = 'custom'"
            >
              <UIcon
                name="i-lucide-calendar-range"
                class="size-3.5"
              />
              Pick the dates
            </button>
          </div>

          <div
            v-if="period === 'custom'"
            class="grid grid-cols-2 gap-2"
          >
            <label>
              <span class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-dimmed">From</span>
              <input
                v-model="customFrom"
                type="date"
                :max="customTo || undefined"
                :class="[NATIVE_INPUT, 'w-full']"
                aria-label="First day of the export"
              >
            </label>
            <label>
              <span class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-dimmed">To</span>
              <input
                v-model="customTo"
                type="date"
                :min="customFrom || undefined"
                :class="[NATIVE_INPUT, 'w-full']"
                aria-label="Last day of the export"
              >
            </label>
          </div>

          <p
            v-if="rangeProblem"
            class="text-xs text-error"
          >
            {{ rangeProblem }}
          </p>
          <p
            v-else
            class="text-xs tabular-nums text-muted"
          >
            {{ dayShort(range.from) }} → {{ dayShort(range.to) }}
            <span class="text-dimmed">· {{ rangeDays }} {{ rangeDays === 1 ? 'day' : 'days' }}</span>
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            label="PDF"
            icon="i-lucide-file-down"
            class="flex-1 justify-center"
            :loading="exporting"
            :disabled="Boolean(rangeProblem)"
            @click="download('pdf')"
          />
          <UButton
            label="CSV"
            icon="i-lucide-table"
            color="neutral"
            variant="subtle"
            class="flex-1 justify-center"
            :loading="exporting"
            :disabled="Boolean(rangeProblem)"
            @click="download('csv')"
          />
        </div>
      </template>
    </UModal>

    <MealForm
      v-model:open="formOpen"
      :day="day"
      :meal="filling"
      @saved="afterSaved"
    />
  </AppPage>
</template>
