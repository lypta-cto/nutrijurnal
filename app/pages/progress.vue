<script setup lang="ts">
import type { Progress } from '~/composables/useBody'
import { formatWater, formatWeight } from '~/composables/useBody'
import type { ChartPoint, SplitPart } from '~/composables/useChartWidth'
import { CHART_COLORS, MACRO_BARS, dayLabel, dayShort, formatKcal, shiftDay } from '~/composables/useEating'

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
const today = useToday()
/** Bumped per load, so a slow answer for the week can't land over the 90 days asked for since */
let asked = 0

async function load() {
  const ask = (asked += 1)
  loading.value = true
  failed.value = false
  const until = today.value
  try {
    const answer = await loadProgress(shiftDay(until, -(span.value - 1)), until, until)
    if (ask === asked) {
      data.value = answer
    }
  } catch {
    if (ask === asked) {
      failed.value = true
    }
  } finally {
    if (ask === asked) {
      loading.value = false
    }
  }
}

onMounted(() => void load())
// A new day (the app was left open overnight) is a new period
watch([span, today], () => void load())

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

/** The period, said over the title: "27 Sep – 3 Oct" */
const periodLabel = computed(() =>
  `${dayShort(shiftDay(today.value, -(span.value - 1)))} – ${dayShort(today.value)}`)

/**
 * Day by day, newest first — the same numbers as the charts, each day with a
 * bar against the target: kcal within it, clay past it, an empty track and
 * "—" for a day nothing was written down. Without a target the bars compare
 * the days with each other.
 */
const rows = computed(() => {
  const scale = kcalTarget.value || Math.max(1, ...days.value.map(entry => entry.kcal))
  return [...days.value].reverse().map(entry => ({
    ...entry,
    share: entry.meals ? Math.min(100, Math.round((entry.kcal / scale) * 100)) : 0,
    over: Boolean(kcalTarget.value) && entry.meals > 0 && entry.kcal > (kcalTarget.value ?? 0)
  }))
})
</script>

<template>
  <AppPage
    title="Progress"
    :eyebrow="periodLabel"
  >
    <template #toolbar>
      <ShellSegmented
        v-model="span"
        label="Period"
        :options="SPANS"
      />
    </template>

    <ShellCard v-if="failed && !data">
      <ShellEmpty
        icon="i-lucide-cloud-off"
        title="Progress didn't load"
        description="The numbers are safe — the connection dropped on the way. Try again in a moment."
      >
        <UButton
          label="Try again"
          icon="i-lucide-rotate-ccw"
          :loading="loading"
          @click="load"
        />
      </ShellEmpty>
    </ShellCard>

    <template v-if="!data && loading">
      <div class="grid grid-cols-2 gap-3">
        <span
          v-for="index in 4"
          :key="index"
          class="app-shimmer h-24 rounded-tile"
        />
      </div>
      <ShellSkeleton
        variant="card"
        :count="5"
      />
      <ShellSkeleton
        variant="card"
        :count="2"
      />
    </template>

    <!-- A refetch keeps the last picture, dimmed, rather than flashing skeletons -->
    <div
      v-if="data"
      class="flex flex-col gap-3 transition-opacity duration-200 ease-soft"
      :class="loading && 'opacity-60'"
      :aria-busy="loading"
    >
      <div class="grid grid-cols-2 gap-3">
        <ShellStatTile
          label="Average day"
          icon="i-lucide-flame"
          :value="averages?.kcal ?? null"
          unit="kcal"
          :hint="kcalAgainstTarget ?? 'on the days you logged'"
          tone="brand"
        >
          <template #value>
            <CountUp
              :value="averages?.kcal ?? 0"
              :format="formatKcal"
            />
          </template>
        </ShellStatTile>

        <ShellStatTile
          label="Streak"
          icon="i-lucide-calendar-check"
          :value="data.streak.current"
          :unit="data.streak.current === 1 ? 'day' : 'days'"
          :hint="streakHint"
        >
          <template #value>
            <CountUp :value="data.streak.current" />
          </template>
        </ShellStatTile>

        <ShellStatTile
          label="Days logged"
          icon="i-lucide-notebook-pen"
          :value="averages?.logged_days ?? 0"
          :unit="`of ${averages?.days ?? span}`"
          :hint="averages?.logged_days === (averages?.days ?? span) ? 'every single one' : 'in this period'"
        >
          <template #value>
            <CountUp :value="averages?.logged_days ?? 0" />
          </template>
        </ShellStatTile>

        <ShellStatTile
          label="Weight"
          icon="i-lucide-scale"
          :value="weightChange !== null
            ? `${weightChange > 0 ? '+' : weightChange < 0 ? '−' : ''}${Math.abs(weightChange).toFixed(1)}`
            : data.weight.last ? data.weight.last.kg.toFixed(1) : null"
          unit="kg"
          :hint="weightChange !== null && data.weight.first
            ? `since ${dayShort(data.weight.first.day)}`
            : data.weight.last ? `weighed ${dayShort(data.weight.last.day)}` : 'not weighed in this period'"
        />
      </div>

      <!-- Energy against the target -->
      <ShellCard
        title="Energy"
        icon="i-lucide-flame"
        hint="kcal a day"
      >
        <template v-if="averages?.logged_days">
          <ChartColumns
            :points="kcalPoints"
            :color="CHART_COLORS.kcal"
            over-color="var(--ui-warning)"
            :format="formatKcal"
            :reference="kcalTarget ? { value: kcalTarget, label: `Target ${formatKcal(kcalTarget)}` } : null"
            label="Kcal per day"
          />
          <p
            v-if="kcalTarget"
            class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted"
          >
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-kcal" />within target</span>
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-warning" />over</span>
            <span class="flex items-center gap-1.5"><span class="h-0 w-3 border-t-[1.5px] border-dashed border-(--ui-text-muted)" />your target</span>
          </p>
        </template>
        <ShellEmpty
          v-else
          compact
          icon="i-lucide-chart-column"
          title="Nothing logged in this period"
          description="Log a meal and the days fill in here."
          class="-mx-4 -mb-4"
        />
      </ShellCard>

      <!-- Where the energy came from -->
      <ShellCard
        v-if="hasMacros"
        title="Macros"
        icon="i-lucide-chart-pie"
        hint="share of kcal, average day"
      >
        <ChartSplit :parts="split" />
      </ShellCard>

      <!-- The weight trend -->
      <ShellCard
        title="Weight"
        icon="i-lucide-scale"
        :hint="weighings ? `${weighings} ${weighings === 1 ? 'weighing' : 'weighings'}` : undefined"
      >
        <ChartLine
          v-if="weighings >= 2"
          :points="weightPoints"
          :color="CHART_COLORS.weight"
          :format="value => value.toFixed(1)"
          label="Weight in kilograms"
        />
        <ShellEmpty
          v-else
          compact
          icon="i-lucide-scale"
          :title="weighings ? 'One weighing so far' : 'No weighings yet'"
          description="Weigh in on Today every few days — the trend shows from the second."
          class="-mx-4 -mb-4"
        />
      </ShellCard>

      <!-- Water against the goal -->
      <ShellCard
        title="Water"
        icon="i-lucide-glass-water"
        icon-class="text-info"
        :hint="averages?.water_ml ? `${formatWater(averages.water_ml)} on average · goal ${formatWater(data.water_goal_ml)}` : `goal ${formatWater(data.water_goal_ml)}`"
      >
        <ChartColumns
          v-if="averages?.water_ml"
          :points="waterPoints"
          :color="CHART_COLORS.water"
          :format="formatWater"
          :reference="{ value: data.water_goal_ml, label: `Goal ${formatWater(data.water_goal_ml)}` }"
          label="Water per day"
          :height="110"
        />
        <ShellEmpty
          v-else
          compact
          icon="i-lucide-glass-water"
          title="No water logged in this period"
          description="Tap a glass on Today each time you drink one."
          class="-mx-4 -mb-4"
        />
      </ShellCard>

      <!-- The same numbers, day by day: every chart's twin -->
      <ShellCard
        flush
        title="Day by day"
        icon="i-lucide-list"
        :hint="kcalTarget ? 'kcal against the target' : 'kcal'"
        :count="averages?.logged_days ? `${averages.logged_days}/${averages.days}` : null"
        :is-empty="!rows.length"
        empty="No days in this period."
      >
        <div
          v-for="entry in rows"
          :key="entry.day"
          class="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 px-4 py-3"
        >
          <span
            class="truncate text-sm font-semibold"
            :class="entry.meals ? 'text-highlighted' : 'text-muted'"
          >{{ dayLabel(entry.day) }}</span>
          <span
            class="h-1.5 overflow-hidden rounded-full bg-elevated"
            aria-hidden="true"
          >
            <span
              class="block h-full rounded-full"
              :class="entry.over ? 'bg-warning' : 'bg-kcal'"
              :style="{ width: `${entry.share}%` }"
            />
          </span>
          <span
            class="text-right text-sm tabular-nums"
            :class="entry.meals ? (entry.over ? 'font-semibold text-warning' : 'font-semibold text-highlighted') : 'text-dimmed'"
          >{{ entry.meals ? formatKcal(entry.kcal) : '—' }}</span>
          <span class="col-span-3 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-caption text-muted tabular-nums">
            <ShellMacroLine
              v-if="entry.meals"
              :macros="entry"
              :kcal="false"
            />
            <span v-else>nothing written down</span>
            <span
              v-if="entry.water_ml"
              class="flex items-center gap-1"
            >
              <UIcon
                name="i-lucide-glass-water"
                class="size-3 text-info"
              />{{ formatWater(entry.water_ml) }}
            </span>
            <span
              v-if="entry.weight_kg !== null"
              class="flex items-center gap-1"
            >
              <UIcon
                name="i-lucide-scale"
                class="size-3"
              />{{ formatWeight(entry.weight_kg) }}
            </span>
          </span>
        </div>
      </ShellCard>
    </div>
  </AppPage>
</template>
