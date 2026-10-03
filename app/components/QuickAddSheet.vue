<script setup lang="ts">
import type { Meal, MealTab } from '~/composables/useEating'
import type { QuickAddKind } from '~/composables/useQuickAdd'

/**
 * The bottom sheet behind every "+": the ways a plate gets into the diary.
 * Mounted once in the default layout and driven by `useQuickAdd()`.
 *
 * Voice happens right here in the sheet; every other way opens the meal form
 * on its own tab, so there is still one place a meal is written.
 */
const quickAdd = useQuickAdd()
const { day } = useEating()

const OPTIONS: { kind: QuickAddKind, label: string, hint: string, icon: string }[] = [
  { kind: 'search', label: 'Search food', hint: 'Find it in the pantry, say how much', icon: 'i-lucide-search' },
  { kind: 'scan', label: 'Scan barcode', hint: 'A photo of the packet', icon: 'i-lucide-barcode' },
  { kind: 'voice', label: 'Voice', hint: 'Say it now, count it later', icon: 'i-lucide-mic' },
  { kind: 'quick', label: 'Quick kcal', hint: 'Just the numbers', icon: 'i-lucide-flame' },
  { kind: 'recipe', label: 'From recipe', hint: 'One of your own dishes', icon: 'i-lucide-book-open' }
]

/** Which tab of the meal form each way opens on */
const FORM_TAB: Record<Exclude<QuickAddKind, 'voice'>, MealTab> = {
  search: 'search',
  scan: 'scan',
  quick: 'kcal',
  recipe: 'recipe'
}

const formOpen = ref(false)
const formTab = ref<MealTab>('search')

/** The sheet shows the list, or the recorder; the form takes over otherwise */
const sheetOpen = computed({
  get: () => quickAdd.isOpen.value && (quickAdd.kind.value === null || quickAdd.kind.value === 'voice'),
  set: (value: boolean) => {
    if (!value) {
      quickAdd.close()
    }
  }
})

watch([quickAdd.isOpen, quickAdd.kind], ([isOpen, kind]) => {
  if (isOpen && kind && kind !== 'voice') {
    formTab.value = FORM_TAB[kind]
    formOpen.value = true
  }
})

// Closing the form closes the whole flow, so the next "+" starts from the list
watch(formOpen, (isOpen) => {
  if (!isOpen && quickAdd.kind.value !== null && quickAdd.kind.value !== 'voice') {
    quickAdd.close()
  }
})

const title = computed(() => (quickAdd.kind.value === 'voice' ? 'Say what you ate' : 'Add food'))

function onSaved(meal: Meal) {
  // Written onto another day: the diary follows it there
  if (meal.day !== day.value) {
    day.value = meal.day
  }
  quickAdd.markSaved()
  quickAdd.close()
}
</script>

<template>
  <UDrawer
    v-model:open="sheetOpen"
    :title="title"
    :description="quickAdd.kind.value === 'voice' ? 'The words become the meal\'s note.' : 'How do you want to write it down?'"
  >
    <template #body>
      <VoiceMeal
        v-if="quickAdd.kind.value === 'voice'"
        :day="day"
        @saved="onSaved"
      />

      <ul
        v-else
        class="app-safe-bottom flex flex-col gap-1"
      >
        <li
          v-for="option in OPTIONS"
          :key="option.kind"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-elevated/60 active:bg-elevated"
            @click="quickAdd.open(option.kind)"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon
                :name="option.icon"
                class="size-5"
              />
            </span>
            <span class="flex min-w-0 flex-col">
              <span class="text-sm font-medium text-highlighted">{{ option.label }}</span>
              <span class="text-xs text-muted">{{ option.hint }}</span>
            </span>
            <UIcon
              name="i-lucide-chevron-right"
              class="ml-auto size-4 shrink-0 text-dimmed"
            />
          </button>
        </li>
      </ul>
    </template>
  </UDrawer>

  <MealForm
    v-model:open="formOpen"
    :day="day"
    :start="formTab"
    @saved="onSaved"
  />
</template>
