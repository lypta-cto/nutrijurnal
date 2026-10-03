<script lang="ts">
/** One ring: what was eaten of something, against what the day allows */
</script>

<script setup lang="ts">
import { formatKcal, formatMacro } from '~/composables/useEating'

export interface RingTrack {
  key: 'kcal' | 'protein' | 'carbs' | 'fat'
  value: number
  /** Null or 0 while no target is set — the ring then stays an empty track */
  goal: number | null
}

/**
 * Progress rings, one inside the other — kcal outside, then protein, carbs and
 * fat — each filling towards its target in the diary's own colour and turning
 * clay once it passes it. The centre is the page's (#default): the kcal left,
 * one big number and what it means.
 *
 *   <ShellMacroRing :tracks="[
 *     { key: 'kcal', value: totals.kcal, goal: target?.kcal ?? null },
 *     { key: 'protein', value: totals.protein, goal: target?.protein ?? null },
 *     { key: 'carbs', value: totals.carbs, goal: target?.carbs ?? null },
 *     { key: 'fat', value: totals.fat, goal: target?.fat ?? null }
 *   ]">
 *     <span class="font-rounded text-[2.125rem] font-bold tabular-nums">1 060</span>
 *     <span class="text-caption text-muted">kcal left</span>
 *   </ShellMacroRing>
 *
 * Four rings leave room for a 2rem number in the middle; a single ring (the
 * day's kcal alone, a recipe, a day in a list) is thicker and takes `text-hero`.
 * Rings fill from empty when they first appear and glide when numbers change.
 */
const props = withDefaults(defineProps<{
  tracks: RingTrack[]
  /** Outer diameter in px */
  size?: number
  /** Stroke width of each ring in px; a single ring defaults to thicker */
  thickness?: number
  /** Space between rings in px */
  gap?: number
  /** Read out instead of the generated summary */
  label?: string
}>(), {
  size: 208,
  thickness: undefined,
  gap: 3,
  label: undefined
})

defineSlots<{ default?: () => unknown }>()

const STROKES = {
  kcal: { fill: 'stroke-kcal', track: 'stroke-kcal/15' },
  protein: { fill: 'stroke-protein', track: 'stroke-protein/15' },
  carbs: { fill: 'stroke-carbs', track: 'stroke-carbs/15' },
  fat: { fill: 'stroke-fat', track: 'stroke-fat/15' }
} as const

const NAMES = { kcal: 'Calories', protein: 'protein', carbs: 'carbs', fat: 'fat' } as const

const stroke = computed(() => props.thickness ?? (props.tracks.length > 1 ? 10 : 16))

// Drawn empty first, then filled, so the rings sweep in rather than appearing full
const drawn = ref(false)

onMounted(() => {
  requestAnimationFrame(() => {
    drawn.value = true
  })
})

const rings = computed(() =>
  props.tracks.map((track, index) => {
    const radius = props.size / 2 - stroke.value / 2 - index * (stroke.value + props.gap)
    const circumference = 2 * Math.PI * Math.max(radius, 0)
    const share = track.goal ? Math.min(track.value / track.goal, 1) : 0
    const over = Boolean(track.goal) && track.value > (track.goal as number)
    const shown = drawn.value ? share : 0
    return {
      ...track,
      radius,
      circumference,
      offset: circumference * (1 - shown),
      visible: shown > 0,
      fill: over ? 'stroke-warning' : STROKES[track.key].fill,
      track: STROKES[track.key].track
    }
  })
)

const summary = computed(() =>
  props.label ?? props.tracks
    .map((track) => {
      const unit = track.key === 'kcal' ? 'kcal' : 'g'
      const format = track.key === 'kcal' ? formatKcal : formatMacro
      const of = track.goal ? ` of ${format(track.goal)}` : ''
      return `${NAMES[track.key]} ${format(track.value)}${of} ${unit}`
    })
    .join(', ')
)
</script>

<template>
  <div
    class="relative shrink-0"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      class="size-full -rotate-90"
      role="img"
      :aria-label="summary"
    >
      <g
        v-for="ring in rings"
        :key="ring.key"
        fill="none"
        :stroke-width="stroke"
      >
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="ring.radius"
          :class="ring.track"
        />
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="ring.radius"
          stroke-linecap="round"
          :stroke-dasharray="ring.circumference"
          :stroke-dashoffset="ring.offset"
          :stroke-opacity="ring.visible ? 1 : 0"
          class="transition-[stroke-dashoffset,stroke,stroke-opacity] duration-700 ease-soft motion-reduce:transition-none"
          :class="ring.fill"
        />
      </g>
    </svg>

    <div
      v-if="$slots.default"
      class="absolute inset-0 flex flex-col items-center justify-center text-center"
    >
      <slot />
    </div>
  </div>
</template>
