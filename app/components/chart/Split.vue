<script setup lang="ts">
import type { SplitPart } from '~/composables/useChartWidth'

/**
 * Where the energy came from: protein, carbs and fat as shares of the kcal,
 * one bar split three ways, with the grams and shares spelled out in the
 * legend under it (and the target's share beside them, when there is one).
 * Part-to-whole at a glance — three segments, never more.
 */
const props = defineProps<{
  parts: SplitPart[]
}>()

const total = computed(() => props.parts.reduce((sum, part) => sum + part.grams * part.energy, 0))
const goalTotal = computed(() => props.parts.reduce((sum, part) => sum + (part.goal ?? 0) * part.energy, 0))

const rows = computed(() => props.parts.map(part => ({
  ...part,
  share: total.value ? Math.round((part.grams * part.energy / total.value) * 100) : 0,
  goalShare: goalTotal.value && part.goal ? Math.round((part.goal * part.energy / goalTotal.value) * 100) : null
})))

const drawn = ref(false)
onMounted(() => requestAnimationFrame(() => {
  drawn.value = true
}))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      class="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-elevated"
      role="img"
      :aria-label="rows.map(row => `${row.label} ${row.share}%`).join(', ')"
    >
      <span
        v-for="row in rows"
        :key="row.key"
        class="split-part h-full first:rounded-l-full last:rounded-r-full"
        :style="{ flexBasis: drawn ? `${row.share}%` : '0%', backgroundColor: row.color }"
      />
    </div>

    <dl class="grid grid-cols-3 gap-2">
      <div
        v-for="row in rows"
        :key="row.key"
        class="flex flex-col"
      >
        <dt class="flex items-center gap-1.5 text-footnote text-muted">
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: row.color }"
          />
          {{ row.label }}
        </dt>
        <dd class="font-rounded text-title3 text-highlighted tabular-nums">
          {{ row.share }}<span class="text-subheadline font-medium text-muted">%</span>
        </dd>
        <dd class="text-caption text-muted tabular-nums">
          {{ Math.round(row.grams) }} g<template v-if="row.goalShare !== null">
            · target {{ row.goalShare }}%
          </template>
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.split-part {
  flex-grow: 0;
  flex-shrink: 0;
  transition: flex-basis 700ms var(--ease-soft);
}

@media (prefers-reduced-motion: reduce) {
  .split-part {
    transition: none;
  }
}
</style>
