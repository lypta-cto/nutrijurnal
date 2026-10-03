<script setup lang="ts">
import type { Targets } from '~/composables/useEating'
import { splitTargets } from '~/composables/useEating'

/**
 * The four daily targets, edited in one place — onboarding, Settings and the
 * diary's own targets dialog all use this, so they never disagree on what a
 * target is. Empty means "not measured", never zero.
 */
const targets = defineModel<Targets>({ required: true })

// The same colour per macro as the scoreboard and every diary row
const FIELDS: { key: keyof Targets, label: string, unit: string, dot: string }[] = [
  { key: 'target_kcal', label: 'Energy', unit: 'kcal', dot: 'bg-emerald-500' },
  { key: 'target_protein', label: 'Protein', unit: 'g', dot: 'bg-sky-500' },
  { key: 'target_carbs', label: 'Carbs', unit: 'g', dot: 'bg-violet-500' },
  { key: 'target_fat', label: 'Fat', unit: 'g', dot: 'bg-amber-500' }
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
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-2 gap-3">
      <UFormField
        v-for="field in FIELDS"
        :key="field.key"
      >
        <template #label>
          <span class="flex items-center gap-1.5">
            <span
              class="size-2 rounded-full"
              :class="field.dot"
            />
            {{ field.label }}
          </span>
        </template>
        <UInput
          :model-value="targets[field.key] ?? undefined"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          placeholder="—"
          class="w-full"
          :ui="{ base: 'tabular-nums', trailing: 'pointer-events-none' }"
          @update:model-value="value => set(field.key, value)"
        >
          <template #trailing>
            <span class="text-xs text-dimmed">{{ field.unit }}</span>
          </template>
        </UInput>
      </UFormField>
    </div>

    <UButton
      label="Split the kcal into macros"
      icon="i-lucide-wand-sparkles"
      size="xs"
      color="neutral"
      variant="ghost"
      class="self-start"
      :disabled="!targets.target_kcal"
      title="30 % protein, 40 % carbs, 30 % fat — a starting point to adjust"
      @click="suggest"
    />
  </div>
</template>
