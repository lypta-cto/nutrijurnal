<script setup lang="ts">
import type { ChartPoint } from '~/composables/useChartWidth'
import { niceTicks } from '~/composables/useChartWidth'

/**
 * Columns per day, from one baseline, with an optional target drawn across
 * them — kcal against the kcal target, water against the water goal. One
 * series, one colour; the target line is a reference on the same axis, never
 * a second scale.
 *
 * Every column is its own hover and focus target (the whole slot, not just
 * the painted bar) and answers with the day and its value; the page keeps a
 * table of the same numbers, so the tooltip never gates anything.
 */
const props = withDefaults(defineProps<{
  points: ChartPoint[]
  /** A CSS colour — a design token, e.g. var(--app-kcal) */
  color: string
  /** Columns past the reference take this colour instead — kcal over the
   *  target turns clay, the same rule as the rings. Left out for water,
   *  where past the goal is no warning. */
  overColor?: string | null
  format: (value: number) => string
  reference?: { value: number, label: string } | null
  /** What the chart shows, for screen readers */
  label: string
  height?: number
}>(), {
  reference: null,
  overColor: null,
  height: 150
})

function fillOf(value: number): string {
  return props.overColor && props.reference && value > props.reference.value ? props.overColor : props.color
}

const box = ref<HTMLElement | null>(null)
const width = useChartWidth(box)

const LEFT = 40
const RIGHT = 6
const TOP = 14
const AXIS = 22

const plotWidth = computed(() => Math.max(40, width.value - LEFT - RIGHT))
const base = computed(() => TOP + props.height)
const slot = computed(() => plotWidth.value / Math.max(1, props.points.length))
const barWidth = computed(() => Math.max(2, Math.min(24, slot.value * 0.62)))

const ticks = computed(() => {
  const highest = Math.max(1, props.reference?.value ?? 0, ...props.points.map(point => point.value ?? 0))
  const found = niceTicks(0, highest * 1.05, 3)
  const step = (found[1] ?? highest) - (found[0] ?? 0) || highest
  // The top tick has to clear the tallest column
  while ((found.at(-1) ?? 0) < highest) {
    found.push(Number(((found.at(-1) ?? 0) + step).toFixed(6)))
  }
  return found
})

const top = computed(() => ticks.value.at(-1) || 1)

function y(value: number): number {
  return base.value - (value / top.value) * props.height
}

function x(index: number): number {
  return LEFT + slot.value * index + (slot.value - barWidth.value) / 2
}

/** Rounded at the data end, square on the baseline */
function column(index: number, value: number): string {
  const left = x(index)
  const right = left + barWidth.value
  const head = y(value)
  const radius = Math.min(4, barWidth.value / 2, base.value - head)
  return `M${left},${base.value}V${head + radius}Q${left},${head} ${left + radius},${head}`
    + `H${right - radius}Q${right},${head} ${right},${head + radius}V${base.value}Z`
}

/** Room one axis label needs — a weekday's letter far less than a two-digit
 *  date — so as many day labels fit as can, always the last one */
const labelRoom = computed(() => 14 + 7 * Math.max(1, ...props.points.map(point => point.label.length)))
const labelEvery = computed(() => Math.max(1, Math.ceil(props.points.length / Math.max(1, Math.floor(plotWidth.value / labelRoom.value)))))

function showsLabel(index: number): boolean {
  const last = props.points.length - 1
  return index === last || (index % labelEvery.value === 0 && last - index >= labelEvery.value / 2)
}

const active = ref<number | null>(null)
const tooltip = computed(() => {
  if (active.value === null) {
    return null
  }
  const point = props.points[active.value]
  if (!point) {
    return null
  }
  const centre = LEFT + slot.value * (active.value + 0.5)
  return { point, left: Math.min(Math.max(centre, 64), width.value - 64) }
})

// Grown from the baseline once, when the chart first appears
const drawn = ref(false)
onMounted(() => requestAnimationFrame(() => {
  drawn.value = true
}))
</script>

<template>
  <div
    ref="box"
    class="relative w-full select-none"
    @pointerleave="active = null"
  >
    <svg
      :width="width"
      :height="base + AXIS"
      role="img"
      :aria-label="label"
      class="block overflow-visible"
    >
      <!-- Gridlines and their values, recessive -->
      <g aria-hidden="true">
        <template
          v-for="tick in ticks"
          :key="tick"
        >
          <line
            :x1="LEFT"
            :x2="LEFT + plotWidth"
            :y1="y(tick)"
            :y2="y(tick)"
            stroke="var(--app-separator)"
            class="[stroke-width:var(--app-hairline)]"
          />
          <text
            :x="LEFT - 6"
            :y="y(tick)"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-(--ui-text-muted) text-[10px] tabular-nums"
          >{{ format(tick) }}</text>
        </template>
      </g>

      <g
        class="chart-grow"
        :class="drawn && 'is-drawn'"
        :style="{ transformOrigin: `0 ${base}px` }"
      >
        <template
          v-for="(point, index) in points"
          :key="point.key"
        >
          <path
            v-if="point.value"
            :d="column(index, point.value)"
            :fill="fillOf(point.value)"
            :opacity="active === null || active === index || points[active]?.value === null ? 1 : 0.45"
            class="transition-opacity duration-200 ease-soft motion-reduce:transition-none"
          />
        </template>
      </g>

      <!-- The target, on the same axis -->
      <g
        v-if="reference && reference.value > 0"
        aria-hidden="true"
      >
        <line
          :x1="LEFT"
          :x2="LEFT + plotWidth"
          :y1="y(reference.value)"
          :y2="y(reference.value)"
          stroke="var(--ui-text-muted)"
          stroke-width="1.5"
          stroke-dasharray="4 3"
        />
        <!-- A halo of the card's colour keeps the label readable over a column -->
        <text
          :x="LEFT + plotWidth"
          :y="y(reference.value) - 4"
          text-anchor="end"
          paint-order="stroke"
          stroke="var(--app-cell)"
          stroke-width="3"
          stroke-linejoin="round"
          class="fill-(--ui-text-muted) text-[10px] font-medium"
        >{{ reference.label }}</text>
      </g>

      <g aria-hidden="true">
        <template
          v-for="(point, index) in points"
          :key="`label-${point.key}`"
        >
          <text
            v-if="showsLabel(index)"
            :x="LEFT + slot * (index + 0.5)"
            :y="base + 15"
            text-anchor="middle"
            class="fill-(--ui-text-muted) text-[10px]"
          >{{ point.label }}</text>
        </template>
      </g>

      <!-- Hit targets: the whole slot, so a thumb never has to land on a thin bar -->
      <rect
        v-for="(point, index) in points"
        :key="`hit-${point.key}`"
        :x="LEFT + slot * index"
        :y="TOP"
        :width="slot"
        :height="height"
        fill="transparent"
        tabindex="0"
        class="cursor-pointer outline-none"
        :aria-label="`${point.title}: ${point.value === null ? 'nothing logged' : format(point.value)}`"
        @pointerenter="active = index"
        @pointerdown="active = index"
        @focus="active = index"
        @blur="active = null"
      />
    </svg>

    <div
      v-if="tooltip"
      class="app-glass pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full rounded-[0.625rem] border-[length:var(--app-hairline)] border-(--app-glass-border) px-3 py-1.5 text-center shadow-overlay"
      :style="{ left: `${tooltip.left}px` }"
      role="status"
    >
      <p class="font-rounded text-subheadline font-semibold text-highlighted tabular-nums">
        {{ tooltip.point.value === null ? '—' : format(tooltip.point.value) }}
      </p>
      <p class="text-caption2 whitespace-nowrap text-muted">
        {{ tooltip.point.title }}<template v-if="tooltip.point.detail">
          · {{ tooltip.point.detail }}
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.chart-grow {
  transform: scaleY(0);
  transition: transform 700ms var(--ease-soft);
}

.chart-grow.is-drawn {
  transform: scaleY(1);
}

@media (prefers-reduced-motion: reduce) {
  .chart-grow {
    transform: none;
    transition: none;
  }
}
</style>
