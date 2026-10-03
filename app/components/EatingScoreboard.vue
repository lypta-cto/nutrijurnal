<script setup lang="ts">
import type { Macros } from '~/composables/useEating'
import { formatKcal } from '~/composables/useEating'

/**
 * The day at a glance: rings for kcal and the three macros filling towards
 * their targets, the kcal still left (or how far over) counting to its new
 * value in the middle, and a bar per macro beside them with the numbers.
 * The rings and bars are the design's (ShellMacroRing, ShellMacroBar), so a
 * target passed turns the same clay everywhere.
 *
 * Without targets the rings stay empty tracks and the middle shows what was
 * eaten, with the one way out of that state underneath.
 */
const props = defineProps<{
  totals: Macros
  /** Null while no targets are set — the numbers still stand on their own */
  target: Macros | null
  meals: number
  loading?: boolean
}>()

/** The only way out of the "no targets" state, handed back to the page */
const emit = defineEmits<{ targets: [] }>()

const kcalTarget = computed(() => (props.target?.kcal ? props.target.kcal : null))
const left = computed(() => (kcalTarget.value === null ? null : kcalTarget.value - props.totals.kcal))

const tracks = computed(() => (['kcal', 'protein', 'carbs', 'fat'] as const).map(key => ({
  key,
  value: props.totals[key],
  goal: props.target?.[key] || null
})))

/** The number in the middle: what is left, how far over, or simply what was eaten */
const centre = computed(() => {
  if (left.value === null) {
    return { value: props.totals.kcal, caption: 'kcal eaten', over: false }
  }
  return left.value >= 0
    ? { value: left.value, caption: 'kcal left', over: false }
    : { value: -left.value, caption: 'kcal over', over: true }
})

const context = computed(() => {
  if (props.loading && !props.meals) {
    return 'reading the day…'
  }
  if (!props.meals) {
    return 'nothing logged yet'
  }
  return `${formatKcal(props.totals.kcal)} kcal · ${props.meals} ${props.meals === 1 ? 'meal' : 'meals'}`
})
</script>

<template>
  <section
    class="app-card flex items-center gap-4 px-4 py-4"
    aria-label="The day so far"
  >
    <ShellMacroRing
      :tracks="tracks"
      :size="148"
      :thickness="9"
    >
      <span
        class="text-[1.65rem] leading-none font-bold"
        :class="centre.over ? 'text-warning' : 'text-highlighted'"
      >
        <CountUp
          :value="centre.value"
          :format="formatKcal"
        />
      </span>
      <span class="mt-1 text-[11px] text-muted">{{ centre.caption }}</span>
    </ShellMacroRing>

    <div class="flex min-w-0 flex-1 flex-col gap-2.5">
      <ShellMacroBar
        v-for="track in tracks.slice(1)"
        :key="track.key"
        :macro="track.key"
        :value="track.value"
        :goal="track.goal"
        compact
      />
      <div class="flex items-baseline gap-2 text-[11px]">
        <span class="truncate text-muted">{{ context }}</span>
        <UButton
          v-if="kcalTarget === null"
          label="Set targets"
          size="xs"
          variant="link"
          class="ml-auto px-0"
          @click="emit('targets')"
        />
      </div>
    </div>
  </section>
</template>
