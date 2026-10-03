<script setup lang="ts">
import type { Meal } from '~/composables/useEating'
import { SLOTS, dayLabel, formatKcal, shiftDay } from '~/composables/useEating'

/**
 * Another day's meals onto this one: pick the day (yesterday to start
 * with), tick what was eaten again, copy. Copies keep the numbers they were
 * eaten at and land in the slots they came from.
 */
const props = defineProps<{
  /** The day the copies go onto */
  day: string
}>()

const emit = defineEmits<{
  copied: [Meal[]]
  back: []
}>()

const { peekDay, copyDay, copyMeal } = useEating()
const toast = useToast()

const source = ref(shiftDay(props.day, -1))
const meals = ref<Meal[]>([])
const chosen = ref(new Set<string>())
const loading = ref(false)
const copying = ref(false)

async function load() {
  loading.value = true
  try {
    meals.value = (await peekDay(source.value)).meals
    chosen.value = new Set(meals.value.map(meal => meal.id))
  } catch {
    meals.value = []
  } finally {
    loading.value = false
  }
}

watch(source, () => void load(), { immediate: true })

function toggle(meal: Meal, on: boolean | 'indeterminate') {
  const next = new Set(chosen.value)
  if (on === true) {
    next.add(meal.id)
  } else {
    next.delete(meal.id)
  }
  chosen.value = next
}

const grouped = computed(() =>
  SLOTS.map(slot => ({ ...slot, meals: meals.value.filter(meal => meal.slot === slot.value) }))
    .filter(group => group.meals.length))

const picked = computed(() => meals.value.filter(meal => chosen.value.has(meal.id)))

async function copy() {
  if (!picked.value.length || copying.value) {
    return
  }
  copying.value = true
  try {
    const everything = picked.value.length === meals.value.length
    const copies = everything
      ? await copyDay(props.day, { from_day: source.value })
      : await Promise.all(picked.value.map(meal => copyMeal(meal.id, { day: props.day })))
    emit('copied', copies)
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        square
        aria-label="Back to the list"
        @click="emit('back')"
      />
      <p class="font-semibold text-highlighted">
        Copy from another day
      </p>
    </div>

    <div class="flex items-center gap-1">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        square
        aria-label="The day before"
        @click="source = shiftDay(source, -1)"
      />
      <label class="relative flex-1 cursor-pointer text-center">
        <span class="text-sm font-medium text-highlighted">{{ dayLabel(source) }}</span>
        <input
          :value="source"
          type="date"
          class="absolute inset-0 cursor-pointer opacity-0"
          aria-label="The day to copy from"
          @change="event => source = (event.target as HTMLInputElement).value || source"
        >
      </label>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        square
        aria-label="The day after"
        @click="source = shiftDay(source, 1)"
      />
    </div>

    <div
      v-if="loading"
      class="flex flex-col gap-2"
    >
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-10 w-full"
      />
    </div>
    <UEmpty
      v-else-if="!meals.length"
      icon="i-lucide-calendar-x"
      title="Nothing written down that day"
      description="Pick another day with the arrows or tap the date."
      variant="naked"
      size="sm"
    />
    <div
      v-else
      class="flex flex-col gap-3"
    >
      <div
        v-for="group in grouped"
        :key="group.value"
        class="flex flex-col gap-1"
      >
        <span class="text-[11px] font-semibold uppercase tracking-wide text-dimmed">{{ group.plural }}</span>
        <label
          v-for="meal in group.meals"
          :key="meal.id"
          class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 active:bg-elevated"
        >
          <UCheckbox
            :model-value="chosen.has(meal.id)"
            :aria-label="`Copy ${meal.title}`"
            @update:model-value="value => toggle(meal, value)"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium text-highlighted">{{ meal.title }}</span>
            <span class="truncate text-[11px] text-muted">{{ meal.items.map(item => item.label).join(', ') || 'No items yet' }}</span>
          </span>
          <span class="shrink-0 text-xs font-medium tabular-nums text-default">{{ formatKcal(meal.kcal) }}</span>
        </label>
      </div>
    </div>

    <UButton
      :label="picked.length ? `Copy ${picked.length} ${picked.length === 1 ? 'meal' : 'meals'} to ${dayLabel(day).toLowerCase() === 'today' ? 'today' : dayLabel(day)}` : 'Pick what to copy'"
      icon="i-lucide-copy"
      size="lg"
      block
      :loading="copying"
      :disabled="!picked.length"
      @click="copy"
    />
  </div>
</template>
