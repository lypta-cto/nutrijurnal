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
/** The day could not be read — never shown as "Nothing written down that day" */
const failed = ref(false)
const copying = ref(false)
// Each load is numbered: stepping on through the days, an older day's answer
// must not land over the one on screen
let loadsAsked = 0

async function load() {
  const ask = (loadsAsked += 1)
  loading.value = true
  try {
    const found = (await peekDay(source.value)).meals
    if (ask === loadsAsked) {
      meals.value = found
      chosen.value = new Set(found.map(meal => meal.id))
      failed.value = false
    }
  } catch {
    if (ask === loadsAsked) {
      meals.value = []
      failed.value = true
    }
  } finally {
    if (ask === loadsAsked) {
      loading.value = false
    }
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
    <div class="flex items-center gap-1">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        square
        class="-ml-2.5"
        aria-label="Back to the list"
        @click="emit('back')"
      />
      <div class="min-w-0 flex-1">
        <p class="text-headline font-semibold text-highlighted">
          Copy from another day
        </p>
        <p class="text-xs text-muted">
          Tick what was eaten again — it lands in the same meals.
        </p>
      </div>
    </div>

    <!-- The day to copy from: a step either way, or tap the date to pick one -->
    <div class="flex items-center gap-2 rounded-full bg-elevated p-1">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        square
        class="rounded-full"
        aria-label="The day before"
        @click="source = shiftDay(source, -1)"
      />
      <label class="relative flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-default text-sm font-semibold text-highlighted shadow-card has-focus-visible:ring-2 has-focus-visible:ring-primary">
        <UIcon
          name="i-lucide-calendar"
          class="size-4 text-muted"
        />
        {{ dayLabel(source) }}
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
        class="rounded-full"
        aria-label="The day after"
        @click="source = shiftDay(source, 1)"
      />
    </div>

    <ShellSkeleton
      v-if="loading"
      variant="rows"
      :count="3"
      class="overflow-hidden rounded-tile border border-default"
    />
    <ShellEmpty
      v-else-if="failed"
      icon="i-lucide-wifi-off"
      title="That day didn't load"
      description="Nothing is lost — check the connection and try again."
    >
      <UButton
        label="Try again"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="soft"
        @click="load"
      />
    </ShellEmpty>
    <ShellEmpty
      v-else-if="!meals.length"
      icon="i-lucide-calendar-x"
      title="Nothing written down that day"
      description="Step to another day with the arrows, or tap the date."
    />
    <div
      v-else
      class="flex flex-col gap-4"
    >
      <section
        v-for="group in grouped"
        :key="group.value"
        class="flex flex-col gap-2"
      >
        <h3 class="app-eyebrow flex items-center gap-1.5 px-1">
          <UIcon
            :name="group.icon"
            class="size-3.5"
          />
          {{ group.plural }}
        </h3>
        <div class="flex flex-col divide-y divide-default overflow-hidden rounded-tile border border-default">
          <label
            v-for="meal in group.meals"
            :key="meal.id"
            class="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 active:bg-elevated/70"
          >
            <UCheckbox
              :model-value="chosen.has(meal.id)"
              :aria-label="`Copy ${meal.title}`"
              @update:model-value="value => toggle(meal, value)"
            />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-body font-semibold text-highlighted">{{ meal.title }}</span>
              <span class="truncate text-xs text-muted">{{ meal.items.map(item => item.label).join(', ') || 'No items yet' }}</span>
            </span>
            <span class="flex w-14 shrink-0 flex-col items-end leading-tight tabular-nums">
              <span class="text-body font-semibold text-highlighted">{{ formatKcal(meal.kcal) }}</span>
              <span class="text-caption text-muted">kcal</span>
            </span>
          </label>
        </div>
      </section>
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
