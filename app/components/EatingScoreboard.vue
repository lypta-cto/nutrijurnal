<script setup lang="ts">
import type { Macros } from '~/composables/useEating'
import { formatKcal } from '~/composables/useEating'

/**
 * The day at a glance, the card that leads Today: four rings filling towards
 * their targets — kcal outside, then protein, carbs and fat — with the kcal
 * still left (or how far over) counting to its new value in the middle, what
 * was eaten and the target either side, and a bar per macro underneath. Past
 * a target the ring and the bar turn clay, the same as everywhere.
 *
 * Without targets the rings stay empty tracks, the middle shows what was
 * eaten, and the one way out of that state is offered underneath.
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

const firstLoad = computed(() => props.loading && !props.meals)
</script>

<template>
  <ShellCard
    tone="brand"
    aria-label="The day so far"
  >
    <div
      v-if="firstLoad"
      class="flex flex-col items-center gap-5 pt-2"
    >
      <ShellSkeleton variant="ring" />
      <ShellSkeleton
        variant="tiles"
        :count="3"
        class="w-full"
      />
    </div>

    <template v-else>
      <div class="flex items-center justify-center gap-3 pt-2">
        <!-- What was eaten and what the day allows, either side of the ring -->
        <div
          v-if="kcalTarget !== null"
          class="flex w-16 shrink-0 flex-col items-center text-center"
        >
          <span class="app-eyebrow">Eaten</span>
          <span class="text-lg leading-tight font-bold text-highlighted tabular-nums">{{ formatKcal(totals.kcal) }}</span>
          <span class="text-caption text-muted">kcal</span>
        </div>

        <ShellMacroRing
          :tracks="tracks"
          :size="184"
          :thickness="9"
        >
          <span
            class="text-[2rem] leading-none font-bold tracking-tight"
            :class="centre.over ? 'text-warning' : 'text-highlighted'"
          >
            <CountUp
              :value="centre.value"
              :format="formatKcal"
            />
          </span>
          <span
            class="mt-1 text-caption font-medium"
            :class="centre.over ? 'text-warning' : 'text-muted'"
          >{{ centre.caption }}</span>
        </ShellMacroRing>

        <div
          v-if="kcalTarget !== null"
          class="flex w-16 shrink-0 flex-col items-center text-center"
        >
          <span class="app-eyebrow">Target</span>
          <span class="text-lg leading-tight font-bold text-highlighted tabular-nums">{{ formatKcal(kcalTarget) }}</span>
          <span class="text-caption text-muted">kcal</span>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-3 gap-4">
        <ShellMacroBar
          v-for="track in tracks.slice(1)"
          :key="track.key"
          :macro="track.key"
          :value="track.value"
          :goal="track.goal"
          compact
        />
      </div>

      <div
        v-if="kcalTarget === null"
        class="-mx-4 mt-4 -mb-4 border-t border-default"
      >
        <ShellEmpty
          compact
          icon="i-lucide-target"
          title="Set your targets"
          description="So the rings have something to fill."
        >
          <UButton
            label="Set"
            size="sm"
            variant="soft"
            @click="emit('targets')"
          />
        </ShellEmpty>
      </div>
    </template>
  </ShellCard>
</template>
