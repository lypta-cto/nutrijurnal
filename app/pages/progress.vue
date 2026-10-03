<script setup lang="ts">
import type { DayTotals } from '~/composables/useEating'
import { dayLabel, formatKcal, formatMacro, shiftDay } from '~/composables/useEating'

/**
 * How the days have gone: the last week or month against the kcal target,
 * and what a written-down day averaged. A first cut — charts and streaks
 * come with the next round of work.
 */
const { settings, target, loadSettings, loadRange } = useEating()

type Span = 7 | 30
const SPANS: { value: Span, label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' }
]

const span = ref<Span>(7)
const days = ref<DayTotals[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const to = localIsoDay()
    days.value = (await loadRange(shiftDay(to, -(span.value - 1)), to)).reverse()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!settings.value) {
    await loadSettings().catch(() => {})
  }
  await load()
})

watch(span, () => void load())

const kcalTarget = computed(() => target.value?.kcal || null)

/** Only days with something written down count towards an average */
const logged = computed(() => days.value.filter(entry => entry.meals > 0))

const averages = computed(() => {
  const count = logged.value.length
  if (!count) {
    return null
  }
  const sum = (key: 'kcal' | 'protein' | 'carbs' | 'fat') => logged.value.reduce((total, entry) => total + entry[key], 0)
  return {
    kcal: sum('kcal') / count,
    protein: sum('protein') / count,
    carbs: sum('carbs') / count,
    fat: sum('fat') / count
  }
})

/** The longest kcal on screen sets the scale, so every bar fits */
const scale = computed(() => Math.max(kcalTarget.value ?? 0, ...days.value.map(entry => entry.kcal), 1))

function width(kcal: number): string {
  return `${Math.round((kcal / scale.value) * 100)}%`
}

function tone(entry: DayTotals): string {
  if (!kcalTarget.value) {
    return 'bg-accented'
  }
  return entry.kcal > kcalTarget.value ? 'bg-amber-500' : 'bg-emerald-500'
}
</script>

<template>
  <AppPage title="Progress">
    <template #toolbar>
      <div class="flex items-center gap-0.5 rounded-xl bg-elevated/70 p-0.5">
        <button
          v-for="entry in SPANS"
          :key="entry.value"
          type="button"
          class="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="span === entry.value ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-default'"
          :aria-pressed="span === entry.value"
          @click="span = entry.value"
        >
          {{ entry.label }}
        </button>
      </div>
    </template>

    <!-- What a written-down day came to, on average -->
    <div class="app-card grid grid-cols-4 gap-2 px-4 py-3">
      <div class="col-span-4 flex items-baseline gap-2">
        <span class="text-2xl font-semibold tabular-nums text-highlighted">{{ averages ? formatKcal(averages.kcal) : '—' }}</span>
        <span class="text-xs text-muted">kcal a day on average</span>
        <span class="ml-auto text-[11px] tabular-nums text-dimmed">{{ logged.length }} of {{ days.length }} days written down</span>
      </div>
      <div
        v-for="macro in (['protein', 'carbs', 'fat'] as const)"
        :key="macro"
        class="flex flex-col text-[11px]"
      >
        <span class="capitalize text-muted">{{ macro }}</span>
        <span class="font-medium tabular-nums text-default">{{ averages ? `${formatMacro(averages[macro])} g` : '—' }}</span>
      </div>
      <div class="flex flex-col text-[11px]">
        <span class="text-muted">Target</span>
        <span class="font-medium tabular-nums text-default">{{ kcalTarget ? formatKcal(kcalTarget) : '—' }}</span>
      </div>
    </div>

    <SheetCard
      title="Day by day"
      icon="i-lucide-calendar-days"
      :loading="loading"
      :is-empty="!logged.length"
      empty="Nothing written down in this period yet."
    >
      <div
        v-for="entry in days"
        :key="entry.day"
        class="flex items-center gap-3 px-4 py-2"
      >
        <span class="w-20 shrink-0 truncate text-xs font-medium text-default">{{ dayLabel(entry.day) }}</span>
        <div class="relative h-2 flex-1 overflow-hidden rounded-full bg-elevated">
          <div
            class="h-full rounded-full"
            :class="tone(entry)"
            :style="{ width: width(entry.kcal) }"
          />
        </div>
        <span
          class="w-14 shrink-0 text-right text-xs tabular-nums"
          :class="entry.meals ? 'text-highlighted' : 'text-dimmed'"
        >{{ entry.meals ? formatKcal(entry.kcal) : '—' }}</span>
      </div>
    </SheetCard>
  </AppPage>
</template>
