<script setup lang="ts">
import type { Food, FoodPick, Macros, Meal, MealItemPayload, MealTab, Slot, Unit } from '~/composables/useEating'
import { SLOTS, amountLabel, dayLabel, formatKcal, shiftDay, slotLabel } from '~/composables/useEating'
import type { QuickAddKind } from '~/composables/useQuickAdd'

/**
 * The bottom sheet behind every "+": logging food in as few taps as a phone
 * allows. Mounted once in the default layout and driven by `useQuickAdd()`.
 *
 * It opens on the slot the clock suggests, a search box, and the foods this
 * person stars and eats — each with the amount it was last eaten in, so the
 * usual breakfast is a few "+" taps. Search, quick kcal, copying another
 * day and voice all happen in the sheet; a recipe, a typed-out plate and a
 * barcode open the full meal form on its own tab.
 *
 * Foods added one after another in one sitting land on one meal, so a
 * breakfast of three foods is one row in the diary, not three.
 */
const quickAdd = useQuickAdd()
const { day, peekDay, quickFoods, searchFoods, setFavourite, addMeal, addItem, updateMeal, removeMeal, removeItem, copyDay } = useEating()
const toast = useToast()

type Panel = 'list' | 'amount' | 'kcal' | 'copy' | 'voice'

/** Which tab of the meal form each of the other ways opens on */
const FORM_TAB: Partial<Record<QuickAddKind, MealTab>> = {
  scan: 'scan',
  recipe: 'recipe'
}

const WAYS: { label: string, icon: string, kind?: QuickAddKind, panel?: Panel, tab?: MealTab }[] = [
  { label: 'Scan', icon: 'i-lucide-scan-barcode', kind: 'scan' },
  { label: 'Voice', icon: 'i-lucide-mic', kind: 'voice' },
  { label: 'Kcal', icon: 'i-lucide-flame', kind: 'quick' },
  { label: 'Recipe', icon: 'i-lucide-book-open', kind: 'recipe' },
  { label: 'Copy', icon: 'i-lucide-copy', panel: 'copy' },
  { label: 'Type', icon: 'i-lucide-pencil-line', tab: 'type' }
]

const panel = ref<Panel>('list')
const formOpen = ref(false)
const formTab = ref<MealTab>('search')

/** The sheet stays up while the full form has the screen */
const sheetOpen = computed({
  get: () => quickAdd.isOpen.value && !formOpen.value,
  set: (value: boolean) => {
    if (!value) {
      quickAdd.close()
    }
  }
})

const slot = computed({
  get: () => quickAdd.slot.value,
  set: (value: Slot) => {
    quickAdd.slot.value = value
  }
})

// --- Opening on the right panel ---------------------------------------------------

watch([quickAdd.isOpen, quickAdd.kind], ([isOpen, kind]) => {
  if (!isOpen) {
    return
  }
  const tab = kind ? FORM_TAB[kind] : undefined
  if (tab) {
    openForm(tab)
    return
  }
  panel.value = kind === 'voice' ? 'voice' : kind === 'quick' ? 'kcal' : 'list'
  if (kind === 'search') {
    nextTick(() => searchInput.value?.inputRef?.focus())
  }
})

watch(quickAdd.isOpen, (isOpen) => {
  if (isOpen) {
    void refreshLists()
    return
  }
  // The next "+" starts clean: the list, no search, no meal half-built
  panel.value = 'list'
  query.value = ''
  results.value = []
  picked.value = null
  session.value = null
})

function openForm(tab: MealTab) {
  formTab.value = tab
  formOpen.value = true
}

// Closing the form closes the whole flow, so the next "+" starts from the list
watch(formOpen, (isOpen) => {
  if (!isOpen) {
    quickAdd.close()
  }
})

function chooseWay(way: typeof WAYS[number]) {
  if (way.tab) {
    openForm(way.tab)
  } else if (way.panel) {
    panel.value = way.panel
  } else if (way.kind) {
    quickAdd.open(way.kind)
  }
}

// --- The lists: starred, recent, yesterday ----------------------------------------

const favourites = ref<FoodPick[]>([])
const recent = ref<FoodPick[]>([])
const listsLoading = ref(false)
const yesterday = ref<Meal[]>([])

async function refreshLists() {
  listsLoading.value = true
  try {
    const [lists, before] = await Promise.all([
      quickFoods(),
      peekDay(shiftDay(day.value, -1)).catch(() => null)
    ])
    favourites.value = lists.favourites
    recent.value = lists.recent
    yesterday.value = before?.meals ?? []
  } catch {
    favourites.value = []
    recent.value = []
  } finally {
    listsLoading.value = false
  }
}

/** Yesterday's meals in the slot being filled — one tap writes them again */
const repeatable = computed(() => yesterday.value.filter(meal => meal.slot === slot.value))
const repeatKcal = computed(() => repeatable.value.reduce((sum, meal) => sum + meal.kcal, 0))
const repeating = ref(false)

async function repeatYesterday() {
  if (repeating.value) {
    return
  }
  repeating.value = true
  try {
    const copies = await copyDay(day.value, { from_day: shiftDay(day.value, -1), slot: slot.value })
    quickAdd.markSaved()
    toast.add({
      title: `Yesterday's ${slotLabel(slot.value).toLowerCase()} copied`,
      icon: 'i-lucide-repeat',
      color: 'success',
      actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => void undoMeals(copies) }]
    })
    quickAdd.close()
  } catch (error) {
    fail(error)
  } finally {
    repeating.value = false
  }
}

async function undoMeals(meals: Meal[]) {
  try {
    await Promise.all(meals.map(meal => removeMeal(meal.id)))
    quickAdd.markSaved()
  } catch (error) {
    fail(error)
  }
}

// --- Search ---------------------------------------------------------------------

const searchInput = ref<{ inputRef?: HTMLInputElement | null } | null>(null)
const query = ref('')
const results = ref<Food[]>([])
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(query, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  if (!value.trim()) {
    results.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    const asked = value
    try {
      const found = await searchFoods(asked.trim(), 25)
      // Typing on: an older answer must not replace a newer one
      if (asked === query.value) {
        results.value = found
      }
    } catch {
      results.value = []
    } finally {
      if (asked === query.value) {
        searching.value = false
      }
    }
  }, 180)
})

// --- Starring ---------------------------------------------------------------------

async function toggleStar(food: Food) {
  const next = !food.favourite
  // The star answers the tap at once; a failure puts it back
  const flip = (list: Food[]) => list.forEach((row) => {
    if (row.id === food.id) {
      row.favourite = next
    }
  })
  flip(results.value)
  flip(favourites.value)
  flip(recent.value)
  try {
    await setFavourite(food.id, next)
    void refreshLists()
  } catch (error) {
    flip(results.value)
    fail(error)
  }
}

// --- Adding -----------------------------------------------------------------------

const picked = ref<Food | FoodPick | null>(null)
const adding = ref(false)
const againBusy = ref<string | null>(null)

/** The meal this sitting is filling, so the next food joins it */
const session = ref<{ meal: Meal, autoTitle: string | null } | null>(null)

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

function pick(food: Food) {
  picked.value = food
  panel.value = 'amount'
}

/**
 * Writes one item down: onto the meal this sitting already started (same
 * day, same slot), or as a new one. A meal named after its single food is
 * renamed after its slot once a second food joins it.
 */
async function write(item: MealItemPayload): Promise<{ meal: Meal, itemId: string | null, created: boolean }> {
  const current = session.value
  if (current && current.meal.day === day.value && current.meal.slot === slot.value) {
    let meal = await addItem(current.meal.id, item)
    if (current.autoTitle !== null && meal.title === current.autoTitle) {
      meal = await updateMeal(meal.id, { title: slotLabel(slot.value) })
    }
    session.value = { meal, autoTitle: null }
    return { meal, itemId: meal.items.at(-1)?.id ?? null, created: false }
  }
  const meal = await addMeal({ day: day.value, slot: slot.value, items: [item] })
  session.value = { meal, autoTitle: meal.title }
  return { meal, itemId: null, created: true }
}

async function addFood(food: Food, quantity: number, unit: Unit) {
  const result = await write({ food_id: food.id, label: food.name, quantity, unit })
  confirmAdded(`${amountLabel(quantity, unit)} ${food.name}`, result)
}

function confirmAdded(what: string, result: { meal: Meal, itemId: string | null, created: boolean }) {
  quickAdd.markSaved()
  toast.add({
    title: `${what} → ${slotLabel(result.meal.slot)}`,
    description: `${dayLabel(result.meal.day)} · ${formatKcal(result.meal.kcal)} kcal in this meal`,
    icon: 'i-lucide-check',
    color: 'success',
    actions: [{
      label: 'Undo',
      color: 'neutral',
      variant: 'outline',
      onClick: () => void undoAdd(result)
    }]
  })
}

async function undoAdd(result: { meal: Meal, itemId: string | null, created: boolean }) {
  try {
    if (result.created || !result.itemId) {
      await removeMeal(result.meal.id)
      if (session.value?.meal.id === result.meal.id) {
        session.value = null
      }
    } else {
      const meal = await removeItem(result.meal.id, result.itemId)
      if (session.value?.meal.id === meal.id) {
        session.value = { ...session.value, meal }
      }
    }
    quickAdd.markSaved()
  } catch (error) {
    fail(error)
  }
}

async function onAmount(amount: { quantity: number, unit: Unit }) {
  const food = picked.value
  if (!food || adding.value) {
    return
  }
  adding.value = true
  try {
    await addFood(food, amount.quantity, amount.unit)
    picked.value = null
    query.value = ''
    panel.value = 'list'
    void refreshLists()
  } catch (error) {
    fail(error)
  } finally {
    adding.value = false
  }
}

/** The "+" on a recent or starred food: the same amount as last time */
async function again(food: FoodPick) {
  if (!food.last_quantity || !food.last_unit || againBusy.value) {
    return
  }
  againBusy.value = food.id
  try {
    await addFood(food, food.last_quantity, food.last_unit)
  } catch (error) {
    fail(error)
  } finally {
    againBusy.value = null
  }
}

async function onKcal(entry: { label: string, macros: Macros }) {
  if (adding.value) {
    return
  }
  adding.value = true
  try {
    const result = await write({ label: entry.label, quantity: 1, unit: 'serving', macros: entry.macros })
    confirmAdded(`${formatKcal(entry.macros.kcal)} kcal`, result)
    panel.value = 'list'
  } catch (error) {
    fail(error)
  } finally {
    adding.value = false
  }
}

function onCopied(meals: Meal[]) {
  quickAdd.markSaved()
  toast.add({
    title: `${meals.length} ${meals.length === 1 ? 'meal' : 'meals'} copied to ${dayLabel(day.value).toLowerCase() === 'today' ? 'today' : dayLabel(day.value)}`,
    icon: 'i-lucide-copy-check',
    color: 'success',
    actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => void undoMeals(meals) }]
  })
  quickAdd.close()
}

function onSaved(meal: Meal) {
  // Written onto another day: the diary follows it there
  if (meal.day !== day.value) {
    day.value = meal.day
  }
  quickAdd.markSaved()
  quickAdd.close()
}

const description = computed(() => {
  if (panel.value === 'voice') {
    return 'Say what you ate — it is read into a meal you check before saving.'
  }
  return `${dayLabel(day.value)} · ${session.value ? `${formatKcal(session.value.meal.kcal)} kcal added so far` : 'pick a slot, then the food'}`
})
</script>

<template>
  <UDrawer
    v-model:open="sheetOpen"
    :title="panel === 'voice' ? 'Say what you ate' : `Add to ${slotLabel(slot)}`"
    :description="description"
    :ui="{ content: 'mx-auto w-full max-w-[34rem] max-h-[92svh]', body: 'app-safe-bottom overflow-y-auto' }"
  >
    <template #body>
      <VoiceMeal
        v-if="panel === 'voice'"
        :day="day"
        :meal-slot="slot"
        @saved="onSaved"
      />

      <FoodAmountPanel
        v-else-if="panel === 'amount' && picked"
        :key="picked.id"
        :food="picked"
        :meal-slot="slot"
        :adding="adding"
        @add="onAmount"
        @back="panel = 'list'"
      />

      <QuickKcalPanel
        v-else-if="panel === 'kcal'"
        :meal-slot="slot"
        :adding="adding"
        @add="onKcal"
        @back="panel = 'list'"
      />

      <CopyMealsPanel
        v-else-if="panel === 'copy'"
        :day="day"
        @copied="onCopied"
        @back="panel = 'list'"
      />

      <div
        v-else
        class="flex flex-col gap-4"
      >
        <!-- Which slot it goes into -->
        <div
          class="grid grid-cols-4 gap-1 rounded-xl bg-elevated p-1"
          role="radiogroup"
          aria-label="Meal"
        >
          <UButton
            v-for="entry in SLOTS"
            :key="entry.value"
            :label="entry.label"
            size="sm"
            role="radio"
            :aria-checked="slot === entry.value"
            class="justify-center rounded-lg"
            :color="slot === entry.value ? 'primary' : 'neutral'"
            :variant="slot === entry.value ? 'solid' : 'ghost'"
            @click="slot = entry.value"
          />
        </div>

        <UInput
          ref="searchInput"
          v-model="query"
          icon="i-lucide-search"
          size="lg"
          placeholder="Search foods — egg, oats, banana…"
          class="w-full"
          :loading="searching"
          enterkeyhint="search"
        >
          <template
            v-if="query"
            #trailing
          >
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="link"
              aria-label="Clear the search"
              @click="query = ''"
            />
          </template>
        </UInput>

        <!-- Search results -->
        <template v-if="query.trim()">
          <div
            v-if="results.length"
            class="-mx-2 flex flex-col divide-y divide-default"
          >
            <FoodRow
              v-for="food in results"
              :key="food.id"
              :food="food"
              @pick="pick"
              @star="toggleStar"
            />
          </div>
          <UEmpty
            v-else-if="!searching"
            icon="i-lucide-search-x"
            title="Not in the pantry yet"
            description="Add it once from the label, or log just the kcal."
            variant="naked"
            size="sm"
            :actions="[
              { label: 'Just the kcal', icon: 'i-lucide-flame', color: 'neutral', variant: 'subtle', onClick: () => { panel = 'kcal' } },
              { label: 'Scan it', icon: 'i-lucide-scan-barcode', color: 'neutral', variant: 'subtle', onClick: () => quickAdd.open('scan') }
            ]"
          />
        </template>

        <template v-else>
          <!-- Every other way in -->
          <div class="grid grid-cols-6 gap-1">
            <button
              v-for="way in WAYS"
              :key="way.label"
              type="button"
              class="flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium text-muted transition-colors active:bg-elevated"
              @click="chooseWay(way)"
            >
              <span class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UIcon
                  :name="way.icon"
                  class="size-5"
                />
              </span>
              {{ way.label }}
            </button>
          </div>

          <!-- Yesterday's same meal, once more -->
          <button
            v-if="repeatable.length"
            type="button"
            class="flex items-center gap-3 rounded-xl border border-default px-3 py-2.5 text-left transition-colors active:bg-elevated"
            :disabled="repeating"
            @click="repeatYesterday"
          >
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <UIcon
                :name="repeating ? 'i-lucide-loader-circle' : 'i-lucide-repeat'"
                class="size-4"
                :class="repeating && 'animate-spin'"
              />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-sm font-medium text-highlighted">Repeat yesterday's {{ slotLabel(slot).toLowerCase() }}</span>
              <span class="truncate text-[11px] text-muted">{{ repeatable.map(meal => meal.title).join(', ') }}</span>
            </span>
            <span class="shrink-0 text-xs font-medium tabular-nums text-default">{{ formatKcal(repeatKcal) }}</span>
          </button>

          <div
            v-if="listsLoading && !favourites.length && !recent.length"
            class="flex flex-col gap-2"
          >
            <USkeleton
              v-for="index in 4"
              :key="index"
              class="h-11 w-full"
            />
          </div>

          <section
            v-if="favourites.length"
            class="flex flex-col"
          >
            <h3 class="flex items-center gap-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-dimmed">
              <UIcon
                name="i-lucide-star"
                class="size-3"
              />
              Starred
            </h3>
            <div class="-mx-2 flex flex-col divide-y divide-default">
              <FoodRow
                v-for="food in favourites"
                :key="food.id"
                :food="food"
                quick
                :busy="againBusy === food.id"
                @pick="pick"
                @star="toggleStar"
                @again="again"
              />
            </div>
          </section>

          <section
            v-if="recent.length"
            class="flex flex-col"
          >
            <h3 class="flex items-center gap-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-dimmed">
              <UIcon
                name="i-lucide-history"
                class="size-3"
              />
              Recent
            </h3>
            <div class="-mx-2 flex flex-col divide-y divide-default">
              <FoodRow
                v-for="food in recent"
                :key="food.id"
                :food="food"
                quick
                :busy="againBusy === food.id"
                @pick="pick"
                @star="toggleStar"
                @again="again"
              />
            </div>
          </section>

          <p
            v-if="!listsLoading && !favourites.length && !recent.length"
            class="text-center text-xs text-muted"
          >
            Search for a food to start. What you eat often shows up here, ready to add again in one tap.
          </p>
        </template>
      </div>
    </template>
  </UDrawer>

  <MealForm
    v-model:open="formOpen"
    :day="day"
    :start="formTab"
    :meal-slot="slot"
    @saved="onSaved"
  />
</template>
