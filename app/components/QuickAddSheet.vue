<script setup lang="ts">
import type { Food, FoodPick, Macros, Meal, MealItemPayload, MealTab, ScanResult, Slot, Unit } from '~/composables/useEating'
import { SLOTS, amountLabel, dayLabel, formatKcal, shiftDay, slotLabel } from '~/composables/useEating'
import type { QuickAddKind } from '~/composables/useQuickAdd'

/**
 * The bottom sheet behind every "+": logging food in as few taps as a phone
 * allows. Mounted once in the default layout and driven by `useQuickAdd()`.
 *
 * It opens on the slot the clock suggests, a search box, and the foods this
 * person stars and eats — each with the amount it was last eaten in, so the
 * usual breakfast is a few "+" taps. Search, the live barcode scanner,
 * quick kcal, copying another day and voice all happen in the sheet; a
 * recipe and a typed-out plate open the full meal form on its own tab.
 *
 * Foods added one after another in one sitting land on one meal, so a
 * breakfast of three foods is one row in the diary, not three.
 */
const quickAdd = useQuickAdd()
const today = useToday()
const { day, peekDay, quickFoods, searchFoods, setFavourite, addMeal, addItem, updateMeal, removeMeal, removeItem, copyDay } = useEating()
const toast = useToast()
const haptics = useHaptics()

type Panel = 'list' | 'amount' | 'kcal' | 'copy' | 'voice' | 'scan'

/** Which tab of the meal form each of the other ways opens on */
const FORM_TAB: Partial<Record<QuickAddKind, MealTab>> = {
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
useSheetHistory(sheetOpen)

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
  panel.value = kind === 'voice' ? 'voice' : kind === 'quick' ? 'kcal' : kind === 'scan' ? 'scan' : 'list'
  if (kind === 'scan') {
    scanMiss.value = null
    scannerKey.value += 1
  }
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
/** The starred and recent foods could not be read — never shown as none yet */
const listsFailed = ref(false)
const yesterday = ref<Meal[]>([])
// Each refresh is numbered: a star or an add refreshes again, and only the
// newest answer may land
let listsAsked = 0

async function refreshLists() {
  const ask = (listsAsked += 1)
  listsLoading.value = true
  try {
    const [lists, before] = await Promise.all([
      quickFoods(),
      // Only the "Repeat yesterday's" shortcut hangs on this one
      peekDay(shiftDay(day.value, -1)).catch(() => null)
    ])
    if (ask === listsAsked) {
      favourites.value = lists.favourites
      recent.value = lists.recent
      yesterday.value = before?.meals ?? []
      listsFailed.value = false
    }
  } catch {
    if (ask === listsAsked) {
      listsFailed.value = true
    }
  } finally {
    if (ask === listsAsked) {
      listsLoading.value = false
    }
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
/** The search itself failed — not the same as a pantry without the food */
const searchFailed = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
// Each search is numbered: only the newest one's answer, or failure, may land
let searchesAsked = 0

async function runSearch() {
  const asked = query.value
  const ask = (searchesAsked += 1)
  searching.value = true
  // Typing on: an older answer, or an older failure, must not land over a newer word
  const current = () => ask === searchesAsked && asked === query.value
  try {
    const found = await searchFoods(asked.trim(), 25)
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

watch(query, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  if (!value.trim()) {
    // Whatever is still in flight is for a word no longer there
    searchesAsked += 1
    results.value = []
    searching.value = false
    searchFailed.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(() => void runSearch(), 180)
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

// --- Scanning ---------------------------------------------------------------------

/** A barcode with no food behind it yet — offered to be added from the label */
const scanMiss = ref<ScanResult | null>(null)
/** Bumped to start a fresh camera after a miss */
const scannerKey = ref(0)
const labelFormOpen = ref(false)

function onScan(result: ScanResult) {
  if (result.food) {
    scanMiss.value = null
    pick(result.food)
    return
  }
  scanMiss.value = result
}

function scanAgain() {
  scanMiss.value = null
  scannerKey.value += 1
}

/** Added once from the label: from now on the barcode finds it */
function onLabelFood(food: Food) {
  scanMiss.value = null
  pick(food)
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
  haptics.success()
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
  return `${dayLabel(day.value, today.value)} · ${session.value ? `${formatKcal(session.value.meal.kcal)} kcal added so far` : 'pick a slot, then the food'}`
})
</script>

<template>
  <UDrawer
    v-model:open="sheetOpen"
    :title="panel === 'voice' ? 'Say what you ate' : `Add to ${slotLabel(slot)}`"
    :description="description"
    :ui="{ ...SHEET_UI, body: 'pb-[max(1.25rem,env(safe-area-inset-bottom))]' }"
  >
    <template #body>
      <Transition
        name="panel"
        mode="out-in"
      >
        <VoiceMeal
          v-if="panel === 'voice'"
          key="voice"
          :day="day"
          :meal-slot="slot"
          @saved="onSaved"
        />

        <FoodAmountPanel
          v-else-if="panel === 'amount' && picked"
          :key="`amount-${picked.id}`"
          :food="picked"
          :meal-slot="slot"
          :adding="adding"
          @add="onAmount"
          @back="panel = 'list'"
        />

        <QuickKcalPanel
          v-else-if="panel === 'kcal'"
          key="kcal"
          :meal-slot="slot"
          :adding="adding"
          @add="onKcal"
          @back="panel = 'list'"
        />

        <div
          v-else-if="panel === 'scan'"
          key="scan"
          class="flex flex-col gap-4"
        >
          <div class="flex items-center gap-1">
            <UButton
              icon="i-lucide-chevron-left"
              variant="ghost"
              square
              class="-ml-3"
              :ui="{ leadingIcon: 'size-6' }"
              aria-label="Back to the list"
              @click="panel = 'list'"
            />
            <p class="text-headline text-highlighted">
              Scan a barcode
            </p>
          </div>

          <div
            v-if="scanMiss"
            class="flex flex-col gap-3"
          >
            <div class="app-card">
              <ShellEmpty
                compact
                icon="i-lucide-circle-help"
                :title="scanMiss.barcode ? `No food for ${scanMiss.barcode} yet` : 'No barcode found'"
                :description="scanMiss.message ?? undefined"
              />
            </div>
            <UButton
              v-if="scanMiss.barcode"
              label="Add it from the label"
              icon="i-lucide-plus"
              size="lg"
              block
              @click="labelFormOpen = true"
            />
            <UButton
              label="Scan another"
              icon="i-lucide-scan-barcode"
              color="neutral"
              variant="soft"
              size="lg"
              block
              @click="scanAgain"
            />
          </div>
          <BarcodeScanner
            v-else
            :key="scannerKey"
            @result="onScan"
          />

          <FoodForm
            v-model:open="labelFormOpen"
            :barcode="scanMiss?.barcode ?? null"
            @saved="onLabelFood"
          />
        </div>

        <CopyMealsPanel
          v-else-if="panel === 'copy'"
          key="copy"
          :day="day"
          @copied="onCopied"
          @back="panel = 'list'"
        />

        <div
          v-else
          key="list"
          class="flex flex-col gap-4"
        >
          <!-- Which slot it goes into -->
          <ShellSegmented
            v-model="slot"
            label="Meal"
            size="sm"
            :options="SLOTS.map(entry => ({ value: entry.value, label: entry.label }))"
          />

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
                size="sm"
                color="neutral"
                variant="ghost"
                square
                class="-mr-1.5 rounded-full"
                aria-label="Clear the search"
                @click="query = ''"
              />
            </template>
          </UInput>

          <!-- Search results -->
          <template v-if="query.trim()">
            <div
              v-if="results.length"
              class="app-card app-divide flex flex-col overflow-hidden"
            >
              <FoodRow
                v-for="food in results"
                :key="food.id"
                :food="food"
                @pick="pick"
                @star="toggleStar"
              />
            </div>
            <ShellSkeleton
              v-else-if="searching"
              variant="rows"
              :count="3"
              class="app-card overflow-hidden"
            />
            <ShellEmpty
              v-else-if="searchFailed"
              icon="i-lucide-wifi-off"
              title="The search didn't load"
              description="Nothing is lost — check the connection and try again."
            >
              <UButton
                label="Try again"
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="soft"
                @click="runSearch"
              />
            </ShellEmpty>
            <ShellEmpty
              v-else
              icon="i-lucide-search-x"
              title="Not in the pantry yet"
              description="Add it once from the label, or write down just the kcal."
            >
              <UButton
                label="Just the kcal"
                icon="i-lucide-flame"
                color="neutral"
                variant="soft"
                @click="panel = 'kcal'"
              />
              <UButton
                label="Scan it"
                icon="i-lucide-scan-barcode"
                color="neutral"
                variant="soft"
                @click="scanMiss = null; panel = 'scan'"
              />
            </ShellEmpty>
          </template>

          <template v-else>
            <!-- Every other way in — a row of equal buttons, the way a contact
                 card offers message, call and mail -->
            <div class="grid grid-cols-6 gap-1.5">
              <button
                v-for="way in WAYS"
                :key="way.label"
                type="button"
                class="app-card flex h-14 min-w-0 flex-col items-center justify-center gap-1 text-caption2 font-medium text-primary outline-none transition-colors duration-120 ease-soft focus-visible:ring-2 focus-visible:ring-primary active:bg-accented motion-reduce:transition-none"
                @click="chooseWay(way)"
              >
                <UIcon
                  :name="way.icon"
                  class="size-5.5"
                />
                {{ way.label }}
              </button>
            </div>

            <!-- Yesterday's same meal, once more -->
            <button
              v-if="repeatable.length"
              type="button"
              class="app-card flex min-h-14 items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors duration-120 ease-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:bg-accented disabled:opacity-60 motion-reduce:transition-none"
              :disabled="repeating"
              @click="repeatYesterday"
            >
              <UIcon
                :name="repeating ? 'i-lucide-loader-circle' : 'i-lucide-repeat'"
                class="size-5.5 shrink-0 text-primary"
                :class="repeating && 'animate-spin'"
              />
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-body text-primary">Repeat yesterday's {{ slotLabel(slot).toLowerCase() }}</span>
                <span class="truncate text-footnote text-muted">{{ repeatable.map(meal => meal.title).join(', ') }}</span>
              </span>
              <span class="flex w-14 shrink-0 flex-col items-end leading-tight tabular-nums">
                <span class="text-body font-medium text-highlighted">{{ formatKcal(repeatKcal) }}</span>
                <span class="text-caption2 text-muted">kcal</span>
              </span>
            </button>

            <ShellSkeleton
              v-if="listsLoading && !favourites.length && !recent.length"
              variant="rows"
              :count="4"
              class="app-card overflow-hidden"
            />

            <section
              v-if="favourites.length"
              class="flex flex-col"
              aria-labelledby="quick-add-starred"
            >
              <h3
                id="quick-add-starred"
                class="app-group-title px-4 pb-1.5"
              >
                Starred
              </h3>
              <TransitionGroup
                tag="div"
                name="list"
                class="app-card app-divide flex flex-col overflow-hidden"
              >
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
              </TransitionGroup>
            </section>

            <section
              v-if="recent.length"
              class="flex flex-col"
              aria-labelledby="quick-add-recent"
            >
              <h3
                id="quick-add-recent"
                class="app-group-title px-4 pb-1.5"
              >
                Recent
              </h3>
              <TransitionGroup
                tag="div"
                name="list"
                class="app-card app-divide flex flex-col overflow-hidden"
              >
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
              </TransitionGroup>
            </section>

            <ShellEmpty
              v-if="listsFailed && !listsLoading && !favourites.length && !recent.length"
              icon="i-lucide-wifi-off"
              title="Your foods didn't load"
              description="Nothing is lost — check the connection and try again."
            >
              <UButton
                label="Try again"
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="soft"
                @click="refreshLists"
              />
            </ShellEmpty>
            <ShellEmpty
              v-else-if="!listsLoading && !favourites.length && !recent.length"
              icon="i-lucide-search"
              title="Your usual foods land here"
              description="Search for a food to start. What you eat often shows up here, ready to add again in one tap."
            />
          </template>
        </div>
      </Transition>
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
