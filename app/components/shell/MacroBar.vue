<script setup lang="ts">
import { formatKcal, formatMacro } from '~/composables/useEating'

/**
 * One macro — or the kcal — against its target: a dot and the label, the
 * numbers (`82 / 140 g`), and a bar in the macro's own colour that turns clay
 * once the target is passed. Without a target the track stays empty and the
 * number stands alone; the bar keeps its place, so a row of them never jumps.
 *
 *   <ShellMacroBar macro="protein" :value="82" :goal="140" />
 *   <div class="grid grid-cols-3 gap-4">
 *     <ShellMacroBar v-for="…" compact … />
 *   </div>
 *
 * `compact` stacks label and numbers in small type over a thinner bar — three
 * side by side under the rings.
 */
type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat'

const props = withDefaults(defineProps<{
  macro: MacroKey
  value: number
  goal: number | null
  /** Defaults to the macro's name */
  label?: string
  /** Defaults to `kcal` for kcal and `g` for the rest */
  unit?: string
  compact?: boolean
}>(), {
  label: undefined,
  unit: undefined,
  compact: false
})

const LOOKS: Record<MacroKey, { label: string, dot: string, fill: string, track: string }> = {
  kcal: { label: 'Calories', dot: 'bg-kcal', fill: 'bg-kcal', track: 'bg-kcal/15 dark:bg-kcal/25' },
  protein: { label: 'Protein', dot: 'bg-protein', fill: 'bg-protein', track: 'bg-protein/15 dark:bg-protein/25' },
  carbs: { label: 'Carbs', dot: 'bg-carbs', fill: 'bg-carbs', track: 'bg-carbs/15 dark:bg-carbs/25' },
  fat: { label: 'Fat', dot: 'bg-fat', fill: 'bg-fat', track: 'bg-fat/15 dark:bg-fat/25' }
}

const look = computed(() => LOOKS[props.macro])
const format = computed(() => (props.macro === 'kcal' ? formatKcal : formatMacro))
const unitText = computed(() => props.unit ?? (props.macro === 'kcal' ? 'kcal' : 'g'))
const goal = computed(() => (props.goal ? props.goal : null))
const over = computed(() => goal.value !== null && props.value > goal.value)

// Filled from empty on first paint, so the bars grow in with the rings
const drawn = ref(false)

onMounted(() => {
  requestAnimationFrame(() => {
    drawn.value = true
  })
})

const width = computed(() => {
  if (!drawn.value || goal.value === null) {
    return '0%'
  }
  return `${Math.min(100, (props.value / goal.value) * 100)}%`
})
</script>

<template>
  <div
    class="flex min-w-0 flex-col"
    :class="compact ? 'gap-1' : 'gap-1.5'"
  >
    <div
      class="flex min-w-0"
      :class="compact ? 'flex-col text-caption' : 'items-baseline gap-1.5 text-footnote'"
    >
      <span class="flex min-w-0 items-center gap-1.5 font-medium text-default">
        <span
          class="size-2 shrink-0 rounded-full"
          :class="over ? 'bg-warning' : look.dot"
        />
        <span class="truncate">{{ label ?? look.label }}</span>
      </span>
      <span
        class="whitespace-nowrap tabular-nums"
        :class="[compact ? '' : 'ml-auto shrink-0', over ? 'text-warning' : 'text-muted']"
      >
        <span
          class="font-semibold"
          :class="over ? '' : 'text-highlighted'"
        >{{ format(value) }}</span>
        <template v-if="goal !== null"> / {{ format(goal) }}</template>
        {{ unitText }}
      </span>
    </div>

    <div
      class="w-full overflow-hidden rounded-full"
      :class="[compact ? 'h-1.5' : 'h-2', look.track]"
      :role="goal !== null ? 'meter' : undefined"
      :aria-label="goal !== null ? (label ?? look.label) : undefined"
      :aria-valuemin="goal !== null ? 0 : undefined"
      :aria-valuemax="goal ?? undefined"
      :aria-valuenow="goal !== null ? Math.round(value) : undefined"
    >
      <div
        class="h-full rounded-full transition-[width,background-color] duration-700 ease-soft motion-reduce:transition-none"
        :class="over ? 'bg-warning' : look.fill"
        :style="{ width }"
      />
    </div>
  </div>
</template>
