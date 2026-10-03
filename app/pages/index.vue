<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DayTotals, Meal, MealItem, Slot, Targets } from '~/composables/useEating'
import {
  ITEM_COLUMNS,
  MEAL_COLUMNS,
  SLOTS,
  changedTargets,
  dayLabel,
  formatGrams,
  formatKcal,
  itemPayload,
  shiftDay,
  slotForNow,
  targetsOf,
  timeLabel,
  unitItemsFor
} from '~/composables/useEating'

/**
 * Today — the diary, one day at a time: the week strip (seven days, each a
 * small ring against the target), the day's rings, then the day by meal —
 * breakfast, lunch, dinner, snacks — each meal a row that opens onto the
 * items it is made of, every item editable where it stands. Water and the
 * scale close the day.
 *
 * Food names come from the data and are shown exactly as they are; everything
 * the app itself says is English.
 */
const {
  settings,
  day,
  dayFailed,
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
  restoreMeal,
  copyMeal,
  copyDay,
  peekDay,
  parseText
} = useEating()

const quickAdd = useQuickAdd()
const toast = useToast()

// Kept current by plugins/today.client.ts — an app left open overnight
// opens the next morning on the new day, not on yesterday
const today = useToday()
const strip = ref<DayTotals[]>([])
/** The day before the one on screen — what "repeat" copies from */
const before = ref<Meal[]>([])
/** Which meals stand open; a new day folds them all back up */
const expanded = ref(new Set<string>())

async function refreshWeek() {
  strip.value = await loadWeek(day.value)
}

async function refreshBefore() {
  const which = shiftDay(day.value, -1)
  const view = await peekDay(which).catch(() => null)
  // The page may have moved on while this was loading
  if (shiftDay(day.value, -1) === which) {
    before.value = view?.meals ?? []
  }
}

async function refreshAll() {
  await Promise.all([
    loadDay().catch(() => {}),
    refreshWeek().catch(() => {}),
    refreshBefore()
  ])
}

/** The four slots in the order a day is eaten, each with its meals */
const slotGroups = computed(() =>
  SLOTS.map(entry => ({
    ...entry,
    meals: meals.value.filter(meal => meal.slot === entry.value),
    kcal: meals.value.filter(meal => meal.slot === entry.value).reduce((sum, meal) => sum + meal.kcal, 0),
    yesterday: before.value.filter(meal => meal.slot === entry.value)
  })))

const repeating = ref<Slot | null>(null)

async function repeat(slot: Slot) {
  if (repeating.value) {
    return
  }
  repeating.value = slot
  try {
    const copies = await copyDay(day.value, { from_day: shiftDay(day.value, -1), slot })
    toast.add({
      title: `${copies.length === 1 ? copies[0]?.title ?? 'Meal' : `${copies.length} meals`} copied`,
      icon: 'i-lucide-repeat',
      color: 'success'
    })
    void refreshWeek()
  } catch (error) {
    fail(error)
  } finally {
    repeating.value = null
  }
}

const route = useRoute()

/**
 * Nothing has come back yet on this visit: the settings load before the day,
 * and until both are in, "0 kcal eaten" and "Set your targets" would be
 * claims about data that simply hasn't arrived. The cards hold their shape.
 */
const settled = ref(false)
/** The day on screen could not be read — an empty diary would be a lie */
const failed = computed(() => dayFailed.value === day.value && !loading.value)
const firstLoad = computed(() => !meals.value.length && !failed.value && (loading.value || !settled.value))
const retrying = ref(false)

async function retry() {
  retrying.value = true
  try {
    await refreshAll()
  } finally {
    retrying.value = false
  }
}

onMounted(async () => {
  // A meal reminder opens the app on "/?add=lunch", the home-screen shortcut
  // on "/?add=now": straight into adding food, on that slot or the clock's
  const asked = route.query.add
  const slot = asked === 'now' ? slotForNow() : SLOTS.find(entry => entry.value === asked)?.value
  if (slot) {
    day.value = today.value
    quickAdd.open(undefined, { slot })
    void navigateTo({ query: {} }, { replace: true })
  }
  await loadSettings().catch(() => {})
  await refreshAll()
  settled.value = true
})

watch(day, async () => {
  expanded.value = new Set()
  await refreshAll()
})

// Something was written down through the "+" sheet — show it
watch(quickAdd.savedAt, () => void refreshAll())

// --- The day -----------------------------------------------------------------

function move(delta: number) {
  // Never into the future: there is nothing to read there yet
  const next = shiftDay(day.value, delta)
  if (next <= today.value) {
    day.value = next
  }
}

/** The date picker's choice — checked here too, because iOS's date wheel
 *  ignores `max` and happily offers next week */
function pickDay(value: string) {
  if (value && value <= today.value) {
    day.value = value
  }
}

/** Which side the new day slides in from: later days from the right */
const dayEnter = ref('')
watch(day, (now, before) => {
  dayEnter.value = before ? (now > before ? 'day-from-next' : 'day-from-prev') : ''
})

/**
 * A sideways swipe across the day moves to the day before or after. Rows
 * that swipe themselves (meals) and form fields keep their own gestures; a
 * mostly vertical move is a scroll and is left alone.
 */
const dayGesture = ref<{ x: number, y: number, at: number } | null>(null)
const haptics = useHaptics()

function onDayDown(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (event.pointerType === 'mouse' || target.closest('[data-swipe-row], input, textarea, select, button, a')) {
    dayGesture.value = null
    return
  }
  dayGesture.value = { x: event.clientX, y: event.clientY, at: Date.now() }
}

function onDayUp(event: PointerEvent) {
  const start = dayGesture.value
  dayGesture.value = null
  if (!start) {
    return
  }
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  const quick = Date.now() - start.at < 600
  if (quick && Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.8) {
    const before = day.value
    move(dx < 0 ? 1 : -1)
    if (day.value !== before) {
      haptics.tap()
    }
  }
}

/** The app bar names the day; the eyebrow over it carries the date in full */
const heading = computed(() => {
  const date = new Date(`${day.value}T12:00:00`)
  const label = dayLabel(day.value, today.value)
  const relative = label === 'Today' || label === 'Yesterday'
  const sameYear = day.value.slice(0, 4) === today.value.slice(0, 4)
  const full = date.toLocaleDateString('en-GB', {
    weekday: relative ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric'
  })
  return {
    title: relative ? label : date.toLocaleDateString('en-GB', { weekday: 'long' }),
    eyebrow: full
  }
})

const weekDays = computed(() =>
  strip.value.map(entry => ({
    ...entry,
    letter: new Date(`${entry.day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'narrow' }),
    date: new Date(`${entry.day}T12:00:00`).getDate(),
    isToday: entry.day === today.value,
    // The diary never opens a day that hasn't happened yet
    future: entry.day > today.value
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
  const position = meal.items.findIndex(row => row.id === item.id)
  try {
    await removeItem(meal.id, item.id)
    void refreshWeek()
    toast.add({
      title: `${item.label} removed`,
      icon: 'i-lucide-trash-2',
      color: 'neutral',
      actions: [{
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: async () => {
          try {
            // Back in its place, with the numbers it had (a quick-kcal line
            // carries its own)
            await addItem(meal.id, { ...itemPayload(item), position: Math.max(0, position) })
            void refreshWeek()
          } catch (error) {
            fail(error)
          }
        }
      }]
    })
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
useSheetHistory(moveOpen)
const moving = ref<Meal | null>(null)
const moveDay = ref(today.value)

function askMove(meal: Meal) {
  moving.value = meal
  moveDay.value = meal.day
  moveOpen.value = true
}

/** A cleared date field holds "", and an iPhone's wheel offers next week */
const moveError = computed(() => dayRefusal(moveDay.value, today.value))

async function doMove() {
  const meal = moving.value
  if (!meal || moveError.value) {
    return
  }
  if (moveDay.value === meal.day) {
    moveOpen.value = false
    return
  }
  try {
    await updateMeal(meal.id, { day: moveDay.value })
    toast.add({ title: `Moved to ${dayLabel(moveDay.value, today.value)}`, icon: 'i-lucide-calendar-check', color: 'success' })
    moveOpen.value = false
    void refreshWeek()
  } catch (error) {
    fail(error)
  }
}

/** The same plate again, on today — written as a new meal, not a link */
async function duplicate(meal: Meal) {
  try {
    const copy = await copyMeal(meal.id, { day: today.value })
    toast.add({
      title: `${copy.title} copied to today`,
      icon: 'i-lucide-copy-check',
      color: 'success',
      actions: [{
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: async () => {
          try {
            await removeMeal(copy.id)
            void refreshWeek()
          } catch (error) {
            fail(error)
          }
        }
      }]
    })
    if (day.value !== today.value) {
      day.value = today.value
    } else {
      void refreshWeek()
    }
  } catch (error) {
    fail(error)
  }
}

/** Deleted at once — the toast's Undo is the safety net, not a dialog first */
async function deleteMeal(meal: Meal) {
  try {
    await removeMeal(meal.id)
    void refreshWeek()
    toast.add({
      title: `${meal.title} deleted`,
      description: `${formatKcal(meal.kcal)} kcal left ${dayLabel(meal.day).toLowerCase() === 'today' ? 'today' : dayLabel(meal.day)}`,
      icon: 'i-lucide-trash-2',
      color: 'neutral',
      actions: [{
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: async () => {
          try {
            await restoreMeal(meal.id)
            void refreshWeek()
          } catch (error) {
            fail(error)
          }
        }
      }]
    })
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
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => void deleteMeal(meal) }
  ]]
}

// --- Targets -----------------------------------------------------------------------

const targetsOpen = ref(false)
useSheetHistory(targetsOpen)
const savingTargets = ref(false)
const targets = ref<Targets>(targetsOf(null))

function openTargets() {
  targets.value = targetsOf(settings.value)
  targetsOpen.value = true
}

async function storeTargets() {
  savingTargets.value = true
  try {
    await saveSettings(changedTargets(targets.value, targetsOf(settings.value)))
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

/** "yesterday", or "the day before" when the diary is open on an older day */
const dayBefore = computed(() => (dayLabel(shiftDay(day.value, -1), today.value) === 'Yesterday' ? 'yesterday' : 'the day before'))

const MEAL_ROW = `${MEAL_COLUMNS} min-h-16 px-4 py-3`
const ITEM_ROW = `${ITEM_COLUMNS} px-4 py-2.5`
</script>

<template>
  <AppPage
    title="Today"
    :compact-title="heading.title"
  >
    <!-- The day's name, tapped to pick another; the date in full above it -->
    <template #heading>
      <p class="app-eyebrow truncate">
        {{ heading.eyebrow }}
      </p>
      <label class="relative flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-lg has-focus-visible:ring-2 has-focus-visible:ring-primary">
        <h1 class="truncate text-large-title text-highlighted">{{ heading.title }}</h1>
        <UIcon
          name="i-lucide-chevron-down"
          class="mt-1.5 size-5 shrink-0 text-primary"
        />
        <input
          :value="day"
          type="date"
          :max="today"
          class="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick a day"
          @click="showDatePicker"
          @change="event => pickDay((event.target as HTMLInputElement).value)"
        >
      </label>
    </template>

    <template #actions>
      <UButton
        v-if="day !== today"
        label="Today"
        variant="ghost"
        class="font-normal"
        @click="day = today"
      />
      <UDropdownMenu
        :items="menuItems"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis"
          variant="ghost"
          square
          aria-label="Targets and export"
          :ui="{ leadingIcon: 'size-6' }"
        />
      </UDropdownMenu>
    </template>

    <!-- The week: seven days, each a small ring against the target. The day
         being read sits on a grey fill; today's letter is the accent wherever it falls. -->
    <nav
      class="-mx-1 flex items-center gap-0.5"
      aria-label="This week"
    >
      <UButton
        icon="i-lucide-chevron-left"
        size="sm"
        color="neutral"
        variant="ghost"
        square
        class="app-hit shrink-0 text-muted"
        aria-label="The day before"
        @click="move(-1)"
      />
      <div class="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
        <template v-if="!weekDays.length">
          <span
            v-for="index in 7"
            :key="index"
            class="app-shimmer h-[3.75rem] rounded-tile"
            aria-hidden="true"
          />
        </template>
        <button
          v-for="entry in weekDays"
          :key="entry.day"
          type="button"
          class="app-press flex min-w-0 flex-col items-center gap-1 rounded-tile py-1.5 outline-none transition-colors duration-200 ease-soft focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 motion-reduce:transition-none"
          :class="day === entry.day ? 'bg-elevated' : 'active:bg-elevated/60'"
          :disabled="entry.future"
          :aria-label="`${dayLabel(entry.day, today)}: ${entry.meals ? `${formatKcal(entry.kcal)} kcal` : 'nothing written down'}`"
          :aria-pressed="day === entry.day"
          @click="day = entry.day"
        >
          <span
            class="text-caption2 font-semibold"
            :class="entry.isToday ? 'text-primary' : 'text-muted'"
          >{{ entry.letter }}</span>
          <ShellMacroRing
            :tracks="[{ key: 'kcal', value: entry.kcal, goal: target?.kcal || null }]"
            :size="30"
            :thickness="3"
            :label="entry.meals ? `${formatKcal(entry.kcal)} kcal` : 'nothing written down'"
          >
            <span
              class="text-caption tabular-nums"
              :class="entry.isToday
                ? 'font-semibold text-primary'
                : entry.meals ? 'font-medium text-highlighted' : 'text-dimmed'"
            >{{ entry.date }}</span>
          </ShellMacroRing>
        </button>
      </div>
      <UButton
        icon="i-lucide-chevron-right"
        size="sm"
        color="neutral"
        variant="ghost"
        square
        class="app-hit shrink-0 text-muted"
        :disabled="day >= today"
        aria-label="The day after"
        @click="move(1)"
      />
    </nav>

    <DemoBanner />

    <!-- The day itself: swiped sideways to the day before or after, and
         sliding in from the side it came from -->
    <div
      :key="day"
      class="flex flex-col gap-3"
      :class="dayEnter"
      :style="{ touchAction: 'pan-y' }"
      @pointerdown="onDayDown"
      @pointerup="onDayUp"
      @pointercancel="dayGesture = null"
    >
      <ShellCard v-if="failed">
        <ShellEmpty
          compact
          icon="i-lucide-wifi-off"
          title="This day didn't load"
          description="Nothing is lost — the diary just couldn't be reached. Check the connection and try again."
          class="-mx-4 -my-4"
        >
          <UButton
            label="Try again"
            size="sm"
            variant="soft"
            :loading="retrying"
            @click="retry"
          />
        </ShellEmpty>
      </ShellCard>

      <EatingScoreboard
        :totals="totals"
        :target="target"
        :meals="meals.length"
        :loading="firstLoad || failed"
        @targets="openTargets"
      />

      <!-- The day by meal: breakfast, lunch, dinner, snacks — each with what
           it came to and its own "+". An empty one is a single line, with
           the day before's once more when there was one. -->
      <ShellCard
        v-for="group in slotGroups"
        :key="group.value"
        flush
        :title="group.plural"
        :icon="group.icon"
        :hint="group.meals.length
          ? `${formatKcal(group.kcal)} kcal`
          : group.yesterday.length || firstLoad || failed ? undefined : 'Nothing yet'"
        :aria-label="group.plural"
      >
        <template #actions>
          <UButton
            v-if="!group.meals.length && group.yesterday.length"
            label="Repeat"
            size="sm"
            variant="ghost"
            class="app-hit font-normal"
            :aria-label="`Repeat ${dayBefore}'s ${group.label.toLowerCase()}`"
            :loading="repeating === group.value"
            @click="repeat(group.value)"
          />
          <UButton
            icon="i-lucide-plus"
            size="sm"
            variant="ghost"
            square
            class="app-hit"
            :ui="{ leadingIcon: 'size-5.5' }"
            :aria-label="`Add to ${group.label}`"
            @click="quickAdd.open(undefined, { slot: group.value })"
          />
        </template>

        <template
          v-if="firstLoad"
          #default
        >
          <ShellSkeleton
            variant="rows"
            :count="1"
          />
        </template>

        <template
          v-else-if="group.meals.length"
          #default
        >
          <TransitionGroup
            tag="div"
            name="list"
            class="app-divide flex flex-col"
          >
            <div
              v-for="meal in group.meals"
              :key="meal.id"
            >
              <SwipeRow
                :left="{ label: 'Delete', icon: 'i-lucide-trash-2' }"
                :right="{ label: day === today ? 'Duplicate' : 'Copy to today', icon: 'i-lucide-copy' }"
                @swipe-left="deleteMeal(meal)"
                @swipe-right="duplicate(meal)"
              >
                <div :class="MEAL_ROW">
                  <span
                    class="text-footnote tabular-nums"
                    :class="meal.at ? 'text-muted' : 'text-dimmed'"
                  >{{ timeLabel(meal.at) }}</span>

                  <button
                    type="button"
                    class="flex min-w-0 flex-col items-start gap-0.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    :aria-expanded="isOpen(meal)"
                    @click="toggle(meal)"
                  >
                    <!-- Two lines before it gives up: a meal's name is worth reading -->
                    <span class="line-clamp-2 text-body break-words text-highlighted">
                      {{ meal.title }}<UIcon
                        v-if="meal.has_voice"
                        name="i-lucide-mic"
                        class="ml-1 inline-block size-3.5 align-[-2px] text-dimmed"
                      /><UIcon
                        name="i-lucide-chevron-down"
                        class="ml-0.5 inline-block size-4 align-[-3px] text-dimmed transition-transform duration-200 ease-soft motion-reduce:transition-none"
                        :class="isOpen(meal) && 'rotate-180'"
                      />
                    </span>
                    <ShellMacroLine
                      v-if="meal.items.length"
                      :macros="meal"
                      :kcal="false"
                    />
                    <span
                      v-else
                      class="text-footnote text-muted"
                    >Not counted yet</span>
                  </button>

                  <!-- What it came to — or the invitation to count it -->
                  <span
                    v-if="meal.items.length"
                    class="flex flex-col items-end leading-tight tabular-nums"
                  >
                    <span class="text-body font-medium text-highlighted">{{ formatKcal(meal.kcal) }}</span>
                    <span class="text-caption2 text-muted">kcal</span>
                  </span>
                  <button
                    v-else
                    type="button"
                    class="app-hit inline-flex h-8 items-center justify-end rounded-lg text-subheadline font-semibold text-primary outline-none transition-opacity duration-120 ease-soft focus-visible:ring-2 focus-visible:ring-primary active:opacity-50 motion-reduce:transition-none"
                    :aria-label="`Fill in ${meal.title}: written down, not counted yet`"
                    @click.stop="fillIn(meal)"
                  >
                    Fill in
                  </button>

                  <UDropdownMenu
                    :items="mealMenu(meal)"
                    :content="{ align: 'end' }"
                  >
                    <UButton
                      icon="i-lucide-ellipsis-vertical"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      square
                      class="app-hit text-muted"
                      :aria-label="`More for ${meal.title}`"
                    />
                  </UDropdownMenu>
                </div>
              </SwipeRow>

              <!-- What the meal was made of — each line corrected where it stands -->
              <div
                class="grid transition-[grid-template-rows] duration-300 ease-soft motion-reduce:transition-none"
                :class="isOpen(meal) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
              >
                <div
                  class="overflow-hidden"
                  :inert="!isOpen(meal)"
                >
                  <div class="app-rule-t bg-muted pb-3">
                    <TransitionGroup
                      tag="div"
                      name="list"
                      class="app-divide flex flex-col"
                    >
                      <div
                        v-for="item in meal.items"
                        :key="item.id"
                        :class="ITEM_ROW"
                      >
                        <UInput
                          v-model="item.label"
                          variant="none"
                          class="col-span-3 min-w-0"
                          :ui="{ root: 'w-full', base: 'px-0 py-1 text-body text-highlighted' }"
                          :aria-label="`Name of ${item.label}`"
                          @focus="remember(item)"
                          @blur="commitItem(meal, item)"
                        />
                        <UButton
                          icon="i-lucide-x"
                          size="sm"
                          color="neutral"
                          variant="ghost"
                          square
                          class="app-hit justify-self-end text-dimmed"
                          :aria-label="`Remove ${item.label}`"
                          @click="dropItem(meal, item)"
                        />
                        <DecimalInput
                          v-model="item.quantity"
                          size="sm"
                          class="w-full"
                          :ui="{ base: 'tabular-nums px-2 text-right' }"
                          :aria-label="`Amount of ${item.label}`"
                          @focus="remember(item)"
                          @blur="commitItem(meal, item)"
                        />
                        <USelect
                          v-model="item.unit"
                          :items="unitItemsFor(item.unit)"
                          value-key="value"
                          size="sm"
                          class="w-full"
                          :aria-label="`Unit for ${item.label}`"
                          @update:model-value="commitItem(meal, item, true)"
                        />
                        <span class="col-span-2 flex min-w-0 flex-col items-end gap-0.5 text-right">
                          <span class="text-footnote font-medium text-highlighted tabular-nums">
                            {{ formatKcal(item.kcal) }} kcal<span
                              v-if="item.unit !== 'serving'"
                              class="font-normal text-dimmed"
                            > · {{ formatGrams(item.grams) }}</span>
                          </span>
                          <ShellMacroLine
                            :macros="item"
                            :kcal="false"
                            class="justify-end"
                          />
                        </span>
                      </div>
                    </TransitionGroup>

                    <!-- One more line onto the plate, typed the way the meal was -->
                    <form
                      class="flex items-center gap-2 px-4 pt-3"
                      @submit.prevent="addLine(meal)"
                    >
                      <UInput
                        v-model="addText[meal.id]"
                        icon="i-lucide-plus"
                        class="min-w-0 flex-1"
                        placeholder="Add an item — “30 g almonds”"
                        :disabled="addingTo === meal.id"
                      />
                      <UButton
                        type="submit"
                        label="Add"
                        variant="ghost"
                        :loading="addingTo === meal.id"
                        :disabled="!(addText[meal.id] ?? '').trim()"
                      />
                    </form>

                    <p
                      v-if="meal.note || meal.has_voice"
                      class="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-3 text-footnote text-muted"
                    >
                      <UIcon
                        :name="meal.has_voice ? 'i-lucide-mic' : 'i-lucide-sticky-note'"
                        class="size-3.5 shrink-0 text-dimmed"
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
          </TransitionGroup>
        </template>
      </ShellCard>

      <WaterCard :day="day" />

      <WeightCard :day="day" />

      <InstallPrompt />
    </div>

    <!-- Onto another day -->
    <UDrawer
      v-model:open="moveOpen"
      :ui="SHEET_UI"
      title="Move the meal"
      :description="moving ? `“${moving.title}” goes to the day you pick.` : ''"
    >
      <template #body>
        <UFormField
          label="Day"
          :hint="moveError ? undefined : dayLabel(moveDay, today)"
          :error="moveError ?? false"
        >
          <input
            v-model="moveDay"
            type="date"
            :max="today"
            class="app-field"
            aria-label="The day to move it to"
          >
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            size="lg"
            @click="moveOpen = false"
          />
          <UButton
            label="Move"
            icon="i-lucide-calendar-check"
            size="lg"
            class="flex-1 justify-center"
            :disabled="Boolean(moveError)"
            @click="doMove"
          />
        </div>
      </template>
    </UDrawer>

    <!-- The day's targets -->
    <UDrawer
      v-model:open="targetsOpen"
      :ui="SHEET_UI"
      title="Daily targets"
      description="What a day should come to. Leave one empty and the diary simply counts it."
    >
      <template #body>
        <TargetsFields v-model="targets" />
      </template>
      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            size="lg"
            :disabled="savingTargets"
            @click="targetsOpen = false"
          />
          <UButton
            label="Save targets"
            size="lg"
            class="flex-1 justify-center"
            :loading="savingTargets"
            @click="storeTargets"
          />
        </div>
      </template>
    </UDrawer>

    <!-- The diary for a period, as a file -->
    <ExportSheet
      v-model:open="exportOpen"
      :day="day"
    />

    <MealForm
      v-model:open="formOpen"
      :day="day"
      :meal="filling"
      @saved="afterSaved"
    />
  </AppPage>
</template>
