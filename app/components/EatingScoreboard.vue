<script setup lang="ts">
import type { Macros } from '~/composables/useEating'
import { MACRO_BARS, formatKcal, formatMacro } from '~/composables/useEating'

/**
 * The day in one line of numbers: the kcal against the target, and one thin
 * bar per macro with `used/target g`. One colour per macro — protein sky,
 * carbs violet, fat amber — the same everywhere in the diary.
 *
 * The card keeps exactly the same shape with or without targets: every track
 * is always drawn, an unset target simply leaves it empty and says so once,
 * rather than four bars quietly collapsing to nothing.
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
const over = computed(() => kcalTarget.value !== null && props.totals.kcal > kcalTarget.value)
const waiting = computed(() => props.loading && !props.meals)

/** What is still to eat, or how far past the target the day went */
const rest = computed(() => {
  if (kcalTarget.value === null) {
    return null
  }
  return Math.round(kcalTarget.value - props.totals.kcal)
})

function share(used: number, goal: number | null): number {
  if (!goal) {
    return 0
  }
  return Math.min(100, Math.round((used / goal) * 100))
}

const kcalShare = computed(() => share(props.totals.kcal, kcalTarget.value))

const bars = computed(() =>
  MACRO_BARS.map((bar) => {
    const used = props.totals[bar.key]
    const goal = props.target?.[bar.key] || null
    return { ...bar, used, goal, share: share(used, goal), over: goal !== null && used > goal }
  })
)

/** One line of context under the headline — never an empty gap */
const context = computed(() => {
  if (waiting.value) {
    return 'reading the day…'
  }
  if (!props.meals) {
    return 'nothing written down yet'
  }
  return `${props.meals} ${props.meals === 1 ? 'meal' : 'meals'}`
})
</script>

<template>
  <div class="app-card flex flex-col gap-4 px-4 py-3">
    <!-- The headline: what the day came to, against what it was meant to -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-baseline gap-2">
        <span
          class="text-2xl font-semibold leading-none tabular-nums"
          :class="kcalTarget === null ? 'text-highlighted' : over ? 'text-warning' : 'text-emerald-500'"
        >{{ waiting ? '…' : formatKcal(totals.kcal) }}</span>
        <span class="text-xs font-medium text-muted">
          <template v-if="kcalTarget !== null">of {{ formatKcal(kcalTarget) }} kcal</template>
          <template v-else>kcal</template>
        </span>
        <span
          class="ml-auto text-[11px] tabular-nums"
          :class="over ? 'text-warning' : 'text-dimmed'"
        >
          <template v-if="rest !== null && rest >= 0">{{ formatKcal(rest) }} left</template>
          <template v-else-if="rest !== null">{{ formatKcal(-rest) }} over</template>
          <template v-else>—</template>
        </span>
      </div>

      <!-- Always drawn, so the card stands the same height either way -->
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
        <div
          class="h-full rounded-full transition-[width] duration-500"
          :class="over ? 'bg-amber-500' : 'bg-emerald-500'"
          :style="{ width: `${kcalTarget === null ? 0 : kcalShare}%` }"
        />
      </div>

      <div class="flex items-baseline gap-2 text-[11px]">
        <span class="text-muted">{{ context }}</span>
        <button
          v-if="kcalTarget === null"
          type="button"
          class="ml-auto font-medium text-primary transition-opacity hover:opacity-75"
          title="A daily target turns these numbers into a score"
          @click="emit('targets')"
        >
          Set targets
        </button>
        <span
          v-else
          class="ml-auto tabular-nums text-dimmed"
        >{{ kcalShare }}%</span>
      </div>
    </div>

    <!-- Protein, carbs, fat — a bar each, in the diary's own colours -->
    <div class="grid grid-cols-3 gap-x-4">
      <div
        v-for="bar in bars"
        :key="bar.key"
        class="flex flex-col gap-1"
      >
        <div class="flex flex-col text-[11px]">
          <span class="flex items-center gap-1.5 font-medium text-default">
            <span
              class="size-2 rounded-full"
              :class="bar.dot"
            />
            {{ bar.label }}
          </span>
          <span
            class="tabular-nums"
            :class="bar.over ? 'text-warning' : 'text-muted'"
          >
            {{ formatMacro(bar.used) }}<template v-if="bar.goal">/{{ formatMacro(bar.goal) }}</template> g
          </span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
          <div
            class="h-full rounded-full transition-[width] duration-500"
            :class="bar.bar"
            :style="{ width: `${bar.goal ? bar.share : 0}%` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
