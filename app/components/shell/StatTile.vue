<script setup lang="ts">
import { formatKcal } from '~/composables/useEating'

/**
 * One number with its label and its context — an average, what's left, the
 * days written down. The label sits on top in small muted type, the value is
 * big and tabular with its unit smaller after it, a hint goes underneath.
 *
 *   <div class="grid grid-cols-2 gap-3">
 *     <ShellStatTile label="Average" :value="2140" unit="kcal" hint="5 of 7 days" tone="brand" />
 *     <ShellStatTile label="Protein" :value="`${formatMacro(avg.protein)}`" unit="g" macro="protein" />
 *   </div>
 *
 * Numbers are rounded with thin-space thousands; pass a string to format it
 * yourself (one decimal on a small macro), null for "—", or fill #value (a
 * CountUp) and keep `value` for deciding whether there is one. `macro` adds
 * its colour dot. `tone`: `card` stands on the canvas, `well` sits inside a card,
 * `brand` / `warning` tint the one tile that matters most.
 */
type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat'

const props = withDefaults(defineProps<{
  label: string
  value: number | string | null
  unit?: string
  hint?: string
  macro?: MacroKey
  icon?: string
  tone?: 'card' | 'well' | 'brand' | 'warning'
  size?: 'md' | 'lg'
}>(), {
  unit: undefined,
  hint: undefined,
  macro: undefined,
  icon: undefined,
  tone: 'card',
  size: 'md'
})

const TONES = {
  card: 'bg-default ring-1 ring-default shadow-card',
  well: 'bg-elevated/70',
  brand: 'bg-primary-50 ring-1 ring-primary-100 dark:bg-primary-950/50 dark:ring-primary-900/70',
  warning: 'bg-warning/8 ring-1 ring-warning/20'
} as const

defineSlots<{
  /** Replaces the printed number — a CountUp, say; `unit` still follows it */
  value?: () => unknown
}>()

const DOTS: Record<MacroKey, string> = {
  kcal: 'bg-kcal',
  protein: 'bg-protein',
  carbs: 'bg-carbs',
  fat: 'bg-fat'
}

const shown = computed(() => {
  if (props.value === null || props.value === '') {
    return '—'
  }
  return typeof props.value === 'number' ? formatKcal(props.value) : props.value
})

const empty = computed(() => shown.value === '—')
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-1 rounded-tile p-3.5"
    :class="TONES[tone]"
  >
    <span class="flex min-w-0 items-center gap-1.5 text-caption font-semibold text-muted">
      <span
        v-if="macro"
        class="size-2 shrink-0 rounded-full"
        :class="DOTS[macro]"
      />
      <UIcon
        v-else-if="icon"
        :name="icon"
        class="size-3.5 shrink-0"
      />
      <span class="truncate">{{ label }}</span>
    </span>

    <span class="flex min-w-0 items-baseline gap-1">
      <span
        class="truncate font-bold tabular-nums tracking-tight"
        :class="[
          size === 'lg' ? 'text-[2rem] leading-none' : 'text-2xl leading-tight',
          empty ? 'text-dimmed' : tone === 'warning' ? 'text-warning' : 'text-highlighted'
        ]"
      ><slot
        v-if="!empty"
        name="value"
      >{{ shown }}</slot><template v-else>{{ shown }}</template></span>
      <span
        v-if="unit && !empty"
        class="shrink-0 text-xs font-semibold text-muted"
      >{{ unit }}</span>
    </span>

    <span
      v-if="hint"
      class="line-clamp-2 text-caption text-muted"
    >{{ hint }}</span>
  </div>
</template>
