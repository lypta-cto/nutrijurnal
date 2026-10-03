<script setup lang="ts">
import { formatKcal, formatMacro } from '~/composables/useEating'

/**
 * A food's, a meal's or a recipe's numbers on one line — "P 24  C 30  F 8
 * 320 kcal" — short enough for a row's second line. Only the letters carry
 * the macro inks; the numbers stay muted, so a list of rows reads calm. The
 * letters are for the eye; a screen reader hears the words.
 *
 *   <ShellMacroLine :macros="meal" />
 *   <ShellMacroLine :macros="food" :kcal="false" size="xs" />
 */
const props = withDefaults(defineProps<{
  macros: { kcal: number, protein: number, carbs: number, fat: number }
  /** The kcal at the end, in the strong text colour */
  kcal?: boolean
  size?: 'caption' | 'xs'
}>(), {
  kcal: true,
  size: 'caption'
})

const PARTS = [
  { key: 'protein', letter: 'P', name: 'protein', ink: 'text-protein-ink' },
  { key: 'carbs', letter: 'C', name: 'carbs', ink: 'text-carbs-ink' },
  { key: 'fat', letter: 'F', name: 'fat', ink: 'text-fat-ink' }
] as const

const parts = computed(() => PARTS.map(part => ({ ...part, value: formatMacro(props.macros[part.key]) })))
</script>

<template>
  <span
    class="inline-flex min-w-0 flex-wrap items-baseline gap-x-2 tabular-nums"
    :class="size === 'xs' ? 'text-footnote' : 'text-caption'"
  >
    <span
      v-for="part in parts"
      :key="part.key"
      class="text-muted"
    >
      <span
        class="font-semibold"
        :class="part.ink"
        aria-hidden="true"
      >{{ part.letter }}</span>
      {{ part.value }}<span class="sr-only"> g {{ part.name }}</span>
    </span>
    <span
      v-if="kcal"
      class="font-medium text-default"
    >{{ formatKcal(macros.kcal) }} kcal</span>
  </span>
</template>
