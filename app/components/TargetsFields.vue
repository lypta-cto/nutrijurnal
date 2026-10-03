<script setup lang="ts">
import type { Targets } from '~/composables/useEating'
import { splitTargets } from '~/composables/useEating'

/**
 * The four daily targets, edited in one place — onboarding, Settings and the
 * diary's own targets dialog all use this, so they never disagree on what a
 * target is. Empty means "not measured", never zero.
 */
const targets = defineModel<Targets>({ required: true })

defineSlots<{
  /** Rows after the fields, inside the same group */
  default?: () => unknown
}>()

// The same colour per macro as the scoreboard and every diary row
const FIELDS: { key: keyof Targets, label: string, unit: string, dot: string }[] = [
  { key: 'target_kcal', label: 'Energy', unit: 'kcal', dot: 'bg-kcal' },
  { key: 'target_protein', label: 'Protein', unit: 'g', dot: 'bg-protein' },
  { key: 'target_carbs', label: 'Carbs', unit: 'g', dot: 'bg-carbs' },
  { key: 'target_fat', label: 'Fat', unit: 'g', dot: 'bg-fat' }
]

/** An emptied number input hands back '' or NaN — both mean "no target" */
function set(key: keyof Targets, value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  targets.value = {
    ...targets.value,
    [key]: value === '' || value === null || !Number.isFinite(number) ? null : number
  }
}

function suggest() {
  if (targets.value.target_kcal) {
    targets.value = splitTargets(targets.value.target_kcal)
  }
}
</script>

<template>
  <!-- One grouped list, Health's way: the name, the number right-aligned
       against its unit, and the one shortcut as an accent row under them -->
  <div class="app-card app-divide flex min-w-0 flex-col overflow-hidden">
    <ShellFieldRow
      v-for="field in FIELDS"
      :key="field.key"
      :label="field.label"
      :unit="field.unit"
      :dot="field.dot"
    >
      <UInput
        :model-value="targets[field.key] ?? undefined"
        type="number"
        inputmode="numeric"
        min="0"
        step="1"
        placeholder="—"
        variant="none"
        :ui="FIELD_ROW_INPUT"
        @update:model-value="value => set(field.key, value)"
      />
    </ShellFieldRow>

    <button
      type="button"
      class="flex min-h-11 items-center px-4 text-left text-body text-primary outline-none transition-colors duration-120 ease-soft focus-visible:bg-elevated active:bg-accented disabled:text-dimmed motion-reduce:transition-none"
      :disabled="!targets.target_kcal"
      title="30 % protein, 40 % carbs, 30 % fat — a starting point to adjust"
      @click="suggest"
    >
      Split the kcal into macros
    </button>

    <!-- More rows of the same group — Settings adds the calculator here -->
    <slot />
  </div>
</template>
