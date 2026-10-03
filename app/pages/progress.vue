<script setup lang="ts">
import type { Progress } from '~/composables/useBody'
import { formatWater, formatWeight } from '~/composables/useBody'
import type { ChartPoint, SplitPart } from '~/composables/useChartWidth'
import { CHART_COLORS, MACRO_BARS, dayLabel, dayShort, formatKcal, formatMacro, shiftDay } from '~/composables/useEating'

/**
 * How the days have gone: a week, a month or a quarter in one answer from
 * the API — the streak of days written down, what a written-down day
 * averaged, kcal against the target, where the energy came from, the weight
 * trend and the water. Every chart has the same numbers in the table at the
 * bottom, so nothing is only readable by hovering.
 */
const { loadProgress } = useBody()

type Span = 7 | 30 | 90
const SPANS: { value: Span, label: string }[] = [
  { value: 7, label: 'Week' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' }
]

const span = ref<Span>(7)
const data = ref<Progress | null>(null)
const loading = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  const today = localIsoDay()
  try {
    data.value = await loadProgress(shiftDay(today, -(span.value - 1)), today, today)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
watch(span, () => void load())

const days = computed(() => data.value?.days ?? [])
const averages = computed(() => data.value?.averages ?? null)
const kcalTarget = computed(() => data.value?.target_kcal || null)

/** A label under the axis: the weekday for a week, the date for longer */
function axisLabel(day: string): string {
  const date = new Date(`${day}T12:00:00`)
  return span.value === 7
    ? date.toLocaleDateString('en-GB', { weekday: 'narrow' })
    : String(date.getDate())
}

const kcalPoints = computed<ChartPoint[]>(() => days.value.map(entry => ({
  key: entry.day,
  label: axisLabel(entry.day),
  title: dayLabel(entry.day),
  value: entry.meals ? entry.kcal : null,
  detail: entry.meals && kcalTarget.value
    ? (entry.kcal > kcalTarget.value ? `${formatKcal(entry.kcal - kcalTarget.value)} over` : `${formatKcal(kcalTarget.value - entry.kcal)} under`)
    : entry.meals ? `${entry.meals} ${entry.meals === 1 ? 'meal' : 'meals'}` : 'nothing logged'
})))

const waterPoints = computed<ChartPoint[]>(() => days.value.map(entry => ({
  key: entry.day,
  label: axisLabel(entry.day),
  title: dayLabel(entry.day),
  value: entry.water_ml || null,
  detail: entry.water_ml && data.value ? `${Math.round((entry.water_ml / data.value.water_goal_ml) * 100)}% of the goal` : undefined
})))

const weightPoints = computed<ChartPoint[]>(() => days.value.map(entry => ({
  key: entry.day,
  label: axisLabel(entry.day),
  title: dayLabel(entry.day),
  value: entry.weight_kg
})))

const weighings = computed(() => days.value.filter(entry => entry.weight_kg !== null).length)

const split = computed<SplitPart[]>(() => MACRO_BARS.map(bar => ({
  key: bar.key,
  label: bar.label,
  grams: averages.value?.[bar.key] ?? 0,
  energy: bar.key === 'fat' ? 9 : 4,
  color: bar.fill,
  goal: data.value?.[`target_${bar.key}`] ?? null
})))

const hasMacros = computed(() => split.value.some(part => part.grams > 0))

/** "−120 a day under target", said only when there is a target */
const kcalAgainstTarget = computed(() => {
  const average = averages.value?.kcal
  if (!average || !kcalTarget.value) {
    return null
  }
  const gap = Math.round(average - kcalTarget.value)
  return gap === 0 ? 'right on target' : `${formatKcal(Math.abs(gap))} ${gap > 0 ? 'over' : 'under'} target`
})

const streakHint = computed(() => {
  const streak = data.value?.streak
  if (!streak) {
    return ''
  }
  if (streak.current && !streak.logged_today) {
    return 'Log today to keep it going'
  }
  return streak.longest > streak.current ? `Best: ${streak.longest} days` : streak.current ? 'Your best yet' : 'Log a meal to start one'
})

const weightChange = computed(() => data.value?.weight.change ?? null)

/** The table view: the same numbers as the charts, newest first */
const rows = computed(() => [...days.value].reverse())

const SEGMENT = 'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors'
</script>

<template>
  <AppPage title="Progress">
    <template #toolbar>
      <div
        class="flex items-center gap-0.5 rounded-xl bg-elevated/70 p-0.5"
        role="radiogroup"
        aria-label="Period"
      >
        <button
          v-for="entry in SPANS"
          :key="entry.value"
          type="button"
          role="radio"
          :class="[SEGMENT, span === entry.value ? 'bg-default text-highlighted shadow-sm' : 'text-muted']"
          :aria-checked="span === entry.value"
          @click="span = entry.value"
        >
          {{ entry.label }}
        </button>
      </div>
    </template>

    <UAlert
      v-if="failed && !data"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Progress could not be loaded"
      :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => void load() }]"
    />

    <template v-if="!data && loading">
      <div class="grid grid-cols-2 gap-3">
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-24 rounded-2xl"
        />
      </div>
      <USkeleton class="h-56 rounded-2xl" />
      <USkeleton class="h-32 rounded-2xl" />
    </template>

    <!-- A refetch keeps the last picture, dimmed, rather than flashing skeletons -->
    <div
      v-if="data"
      class="flex flex-col gap-4 transition-opacity duration-200"
      :class="loading && 'opacity-60'"
      :aria-busy="loading"
    >
      <div class="grid grid-cols-2 gap-3">
        <div class="app-card flex flex-col gap-1 px-4 py-3">
          <span class="flex items-center gap-1.5 text-xs font-medium text-muted">
            <UIcon
              name="i-lucide-flame"
              class="size-3.5 text-warning"
            />
            Streak
          </span>
          <span class="text-2xl font-semibold text-highlighted">
            <CountUp :value="data.streak.current" /> <span class="text-sm font-medium text-muted">{{ data.streak.current === 1 ? 'day' : 'days' }}</span>
          </span>
          <span class="text-[11px] text-muted">{{ streakHint }}</span>
        </div>

        <div class="app-card flex flex-col gap-1 px-4 py-3">
          <span class="text-xs font-medium text-muted">Average day</span>
          <span class="text-2xl font-semibold text-highlighted">
            <template v-if="averages?.kcal"><CountUp
              :value="averages.kcal"
              :format="formatKcal"
            /> <span class="text-sm font-medium text-muted">kcal</span></template>
            <template v-else>—</template>
          </span>
          <span class="text-[11px] text-muted">{{ kcalAgainstTarget ?? 'on the days you logged' }}</span>
        </div>

        <div class="app-card flex flex-col gap-1 px-4 py-3">
          <span class="text-xs font-medium text-muted">Days logged</span>
          <span class="text-2xl font-semibold text-highlighted">
            <CountUp :value="averages?.logged_days ?? 0" /> <span class="text-sm font-medium text-muted">of {{ averages?.days ?? span }}</span>
          </span>
          <UProgress
            :model-value="averages?.logged_days ?? 0"
            :max="averages?.days || span"
            size="xs"
            aria-label="Days logged in this period"
          />
        </div>

        <div class="app-card flex flex-col gap-1 px-4 py-3">
          <span class="text-xs font-medium text-muted">Weight</span>
          <span class="text-2xl font-semibold text-highlighted">
            <template v-if="weightChange !== null">{{ weightChange > 0 ? '+' : weightChange < 0 ? '−' : '' }}{{ Math.abs(weightChange).toFixed(1) }} <span class="text-sm font-medium text-muted">kg</span></template>
            <template v-else-if="data.weight.last">{{ data.weight.last.kg.toFixed(1) }} <span class="text-sm font-medium text-muted">kg</span></template>
            <template v-else>—</template>
          </span>
          <span class="text-[11px] text-muted">
            <template v-if="weightChange !== null && data.weight.first">since {{ dayShort(data.weight.first.day) }}</template>
            <template v-else-if="data.weight.last">weighed {{ dayShort(data.weight.last.day) }}</template>
            <template v-else>not weighed in this period</template>
          </span>
        </div>
      </div>

      <!-- Energy against the target -->
      <section class="app-card flex flex-col gap-3 px-4 py-3">
        <header class="flex items-baseline gap-2">
          <h2 class="text-sm font-semibold text-highlighted">
            Energy
          </h2>
          <span class="text-xs text-muted">kcal a day<template v-if="kcalTarget"> · dashed line is your target</template></span>
        </header>
        <ChartColumns
          v-if="averages?.logged_days"
          :points="kcalPoints"
          :color="CHART_COLORS.kcal"
          :format="formatKcal"
          :reference="kcalTarget ? { value: kcalTarget, label: `Target ${formatKcal(kcalTarget)}` } : null"
          label="Kcal per day"
        />
        <UEmpty
          v-else
          icon="i-lucide-chart-column"
          title="Nothing logged in this period"
          description="Log a meal and the days start filling in here."
          variant="naked"
          size="sm"
        />
      </section>

      <!-- Where the energy came from -->
      <section
        v-if="hasMacros"
        class="app-card flex flex-col gap-3 px-4 py-3"
      >
        <header class="flex items-baseline gap-2">
          <h2 class="text-sm font-semibold text-highlighted">
            Macros
          </h2>
          <span class="text-xs text-muted">share of kcal, average day</span>
        </header>
        <ChartSplit :parts="split" />
      </section>

      <!-- The weight trend -->
      <section class="app-card flex flex-col gap-3 px-4 py-3">
        <header class="flex items-baseline gap-2">
          <h2 class="text-sm font-semibold text-highlighted">
            Weight
          </h2>
          <span
            v-if="weighings"
            class="text-xs text-muted"
          >{{ weighings }} {{ weighings === 1 ? 'weighing' : 'weighings' }}</span>
        </header>
        <ChartLine
          v-if="weighings >= 2"
          :points="weightPoints"
          :color="CHART_COLORS.weight"
          :format="value => value.toFixed(1)"
          label="Weight in kilograms"
        />
        <UEmpty
          v-else
          icon="i-lucide-scale"
          :title="weighings ? 'One weighing so far' : 'No weighings yet'"
          description="Weigh in on Today every few days — the trend shows up from the second one."
          variant="naked"
          size="sm"
        />
      </section>

      <!-- Water against the goal -->
      <section class="app-card flex flex-col gap-3 px-4 py-3">
        <header class="flex items-baseline gap-2">
          <h2 class="text-sm font-semibold text-highlighted">
            Water
          </h2>
          <span class="text-xs text-muted">
            <template v-if="averages?.water_ml">{{ formatWater(averages.water_ml) }} on average · </template>goal {{ formatWater(data.water_goal_ml) }}
          </span>
        </header>
        <ChartColumns
          v-if="averages?.water_ml"
          :points="waterPoints"
          :color="CHART_COLORS.water"
          :format="formatWater"
          :reference="{ value: data.water_goal_ml, label: `Goal ${formatWater(data.water_goal_ml)}` }"
          label="Water per day"
          :height="110"
        />
        <UEmpty
          v-else
          icon="i-lucide-glass-water"
          title="No water logged in this period"
          description="Tap a glass on Today each time you drink one."
          variant="naked"
          size="sm"
        />
      </section>

      <!-- The same numbers as a table: every chart's twin -->
      <SheetCard
        title="Day by day"
        icon="i-lucide-table"
        :is-empty="!rows.length"
        empty="No days in this period."
      >
        <div class="grid grid-cols-[minmax(0,1fr)_3.75rem_5.5rem_3.25rem_3.5rem] gap-x-2 bg-elevated/40 px-4 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-dimmed">
          <span class="text-left">Day</span>
          <span>kcal</span>
          <span>P · C · F</span>
          <span>Water</span>
          <span>Weight</span>
        </div>
        <div
          v-for="entry in rows"
          :key="entry.day"
          class="grid grid-cols-[minmax(0,1fr)_3.75rem_5.5rem_3.25rem_3.5rem] items-baseline gap-x-2 px-4 py-2 text-right text-xs tabular-nums"
        >
          <span class="truncate text-left font-medium text-default">{{ dayLabel(entry.day) }}</span>
          <span :class="entry.meals ? 'font-medium text-highlighted' : 'text-dimmed'">{{ entry.meals ? formatKcal(entry.kcal) : '—' }}</span>
          <span :class="entry.meals ? 'text-muted' : 'text-dimmed'">{{ entry.meals ? `${formatMacro(entry.protein)} · ${formatMacro(entry.carbs)} · ${formatMacro(entry.fat)}` : '—' }}</span>
          <span :class="entry.water_ml ? 'text-muted' : 'text-dimmed'">{{ entry.water_ml ? formatWater(entry.water_ml) : '—' }}</span>
          <span :class="entry.weight_kg !== null ? 'text-muted' : 'text-dimmed'">{{ entry.weight_kg !== null ? formatWeight(entry.weight_kg).replace(' kg', '') : '—' }}</span>
        </div>
      </SheetCard>
    </div>
  </AppPage>
</template>
