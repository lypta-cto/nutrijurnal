<script setup lang="ts">
import type { ChartPoint } from '~/composables/useChartWidth'
import { niceTicks } from '~/composables/useChartWidth'

/**
 * A value that drifts over time — the weight. Days without a value are
 * skipped and the line carries on to the next one; the axis hugs the values
 * (a weight chart from zero is a flat line). A crosshair follows the pointer
 * or the arrow keys to the nearest day that has a value.
 */
const props = withDefaults(defineProps<{
  points: ChartPoint[]
  /** A CSS colour */
  color: string
  format: (value: number) => string
  label: string
  height?: number
}>(), {
  height: 140
})

const box = ref<HTMLElement | null>(null)
const width = useChartWidth(box)

const LEFT = 40
const RIGHT = 36
const TOP = 12
const AXIS = 22

const plotWidth = computed(() => Math.max(40, width.value - LEFT - RIGHT))
const base = computed(() => TOP + props.height)
const slot = computed(() => plotWidth.value / Math.max(1, props.points.length))

const known = computed(() =>
  props.points
    .map((point, index) => ({ point, index, value: point.value }))
    .filter((entry): entry is { point: ChartPoint, index: number, value: number } => entry.value !== null))

const ticks = computed(() => {
  const values = known.value.map(entry => entry.value)
  if (!values.length) {
    return [0, 1]
  }
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max(0.5, (high - low) * 0.2)
  const found = niceTicks(low - pad, high + pad, 3)
  return found.length > 1 ? found : [low - 1, high + 1]
})

const domain = computed(() => {
  const values = known.value.map(entry => entry.value)
  const low = Math.min(ticks.value[0] ?? 0, ...values)
  const high = Math.max(ticks.value.at(-1) ?? 1, ...values)
  return { low, high: high > low ? high : low + 1 }
})

function x(index: number): number {
  return LEFT + slot.value * (index + 0.5)
}

function y(value: number): number {
  const { low, high } = domain.value
  return base.value - ((value - low) / (high - low)) * props.height
}

const path = computed(() =>
  known.value.map((entry, order) => `${order ? 'L' : 'M'}${x(entry.index)},${y(entry.value)}`).join(''))

/** Every weighing gets a dot while they are few; past that only the ends do */
const dots = computed(() => {
  const all = known.value
  return all.length <= 31 ? all : [all[0]!, all.at(-1)!]
})

const last = computed(() => known.value.at(-1) ?? null)

const labelEvery = computed(() => Math.max(1, Math.ceil(props.points.length / Math.max(1, Math.floor(plotWidth.value / 34)))))

function showsLabel(index: number): boolean {
  const final = props.points.length - 1
  return index === final || (index % labelEvery.value === 0 && final - index >= labelEvery.value / 2)
}

// --- The crosshair -----------------------------------------------------------

const active = ref<number | null>(null)

function nearest(index: number): number | null {
  let best: number | null = null
  for (const entry of known.value) {
    if (best === null || Math.abs(entry.index - index) < Math.abs(best - index)) {
      best = entry.index
    }
  }
  return best
}

function onPointer(event: PointerEvent) {
  const bounds = (event.currentTarget as SVGElement).getBoundingClientRect()
  const index = Math.floor((event.clientX - bounds.left - LEFT) / slot.value)
  active.value = nearest(Math.min(props.points.length - 1, Math.max(0, index)))
}

function onKey(event: KeyboardEvent) {
  if (!known.value.length) {
    return
  }
  const order = known.value.findIndex(entry => entry.index === active.value)
  if (event.key === 'ArrowLeft') {
    active.value = known.value[Math.max(0, (order === -1 ? known.value.length : order) - 1)]?.index ?? null
    event.preventDefault()
  } else if (event.key === 'ArrowRight') {
    active.value = known.value[Math.min(known.value.length - 1, order + 1)]?.index ?? null
    event.preventDefault()
  } else if (event.key === 'Escape') {
    active.value = null
  }
}

const tooltip = computed(() => {
  if (active.value === null) {
    return null
  }
  const point = props.points[active.value]
  if (!point || point.value === null) {
    return null
  }
  return { point, value: point.value, left: Math.min(Math.max(x(active.value), 56), width.value - 56) }
})
</script>

<template>
  <div
    ref="box"
    class="relative w-full rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-primary"
    tabindex="0"
    :aria-label="`${label}. Use the arrow keys to read each weighing.`"
    @keydown="onKey"
    @blur="active = null"
  >
    <svg
      :width="width"
      :height="base + AXIS"
      role="img"
      :aria-label="label"
      class="block overflow-visible"
      @pointermove="onPointer"
      @pointerdown="onPointer"
      @pointerleave="active = null"
    >
      <g aria-hidden="true">
        <template
          v-for="tick in ticks"
          :key="tick"
        >
          <line
            v-if="tick >= domain.low && tick <= domain.high"
            :x1="LEFT"
            :x2="LEFT + plotWidth"
            :y1="y(tick)"
            :y2="y(tick)"
            stroke="var(--ui-border)"
            stroke-width="1"
          />
          <text
            v-if="tick >= domain.low && tick <= domain.high"
            :x="LEFT - 6"
            :y="y(tick)"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-(--ui-text-muted) text-[10px] tabular-nums"
          >{{ format(tick) }}</text>
        </template>

        <template
          v-for="(point, index) in points"
          :key="`label-${point.key}`"
        >
          <text
            v-if="showsLabel(index)"
            :x="x(index)"
            :y="base + 15"
            text-anchor="middle"
            class="fill-(--ui-text-muted) text-[10px]"
          >{{ point.label }}</text>
        </template>
      </g>

      <line
        v-if="tooltip"
        :x1="x(active ?? 0)"
        :x2="x(active ?? 0)"
        :y1="TOP"
        :y2="base"
        stroke="var(--ui-border-accented)"
        stroke-width="1"
        aria-hidden="true"
      />

      <path
        :d="path"
        fill="none"
        :stroke="color"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        class="chart-draw"
        pathLength="1"
      />

      <!-- Each weighing: a dot with a ring of the card's own colour -->
      <circle
        v-for="entry in dots"
        :key="entry.point.key"
        :cx="x(entry.index)"
        :cy="y(entry.value)"
        :r="active === entry.index ? 5.5 : 4"
        :fill="color"
        stroke="var(--ui-bg)"
        stroke-width="2"
        class="transition-[r] duration-200 ease-soft motion-reduce:transition-none"
      />

      <!-- The latest value, at the end of the line -->
      <text
        v-if="last"
        :x="x(last.index) + 8"
        :y="y(last.value)"
        dominant-baseline="middle"
        class="fill-(--ui-text-highlighted) text-[11px] font-semibold tabular-nums"
      >{{ format(last.value) }}</text>
    </svg>

    <div
      v-if="tooltip"
      class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-inverted px-3 py-2 text-center shadow-overlay"
      :style="{ left: `${tooltip.left}px` }"
      role="status"
    >
      <p class="text-sm font-semibold tabular-nums text-inverted">
        {{ format(tooltip.value) }}
      </p>
      <p class="text-[11px] whitespace-nowrap text-inverted opacity-70">
        {{ tooltip.point.title }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* The line draws itself in once; still under reduced motion */
.chart-draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: chart-draw 700ms var(--ease-soft) forwards;
}

@keyframes chart-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chart-draw {
    stroke-dasharray: none;
    stroke-dashoffset: 0;
    animation: none;
  }
}
</style>
