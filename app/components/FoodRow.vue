<script setup lang="ts">
import type { Food, FoodPick } from '~/composables/useEating'
import { amountLabel, formatKcal, formatMacro } from '~/composables/useEating'

/**
 * One food in a list you pick from: its name, what 100 g of it is worth, a
 * star, and — when it was eaten before — a "+" that writes it down again in
 * the same amount with one tap.
 */
const props = defineProps<{
  food: Food | FoodPick
  /** Show the one-tap "+" with the last amount (recent and starred lists) */
  quick?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  pick: [Food]
  star: [Food]
  again: [FoodPick]
}>()

const last = computed(() => {
  const food = props.food as FoodPick
  return food.last_quantity && food.last_unit ? { quantity: food.last_quantity, unit: food.last_unit } : null
})
</script>

<template>
  <div class="flex items-center gap-1 px-2">
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors active:bg-elevated"
      @click="emit('pick', food)"
    >
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex min-w-0 items-baseline gap-2">
          <span class="truncate text-sm font-medium text-highlighted">{{ food.name }}</span>
          <UBadge
            v-if="food.mine"
            label="Mine"
            size="sm"
            color="neutral"
            variant="subtle"
            class="shrink-0"
          />
        </span>
        <span class="flex min-w-0 gap-x-2 text-[11px] tabular-nums text-muted">
          <span
            v-if="last"
            class="shrink-0 font-medium text-default"
          >{{ amountLabel(last.quantity, last.unit) }}</span>
          <span
            v-else-if="food.brand"
            class="truncate"
          >{{ food.brand }}</span>
          <span class="shrink-0">P {{ formatMacro(food.protein) }} · C {{ formatMacro(food.carbs) }} · F {{ formatMacro(food.fat) }}</span>
        </span>
      </span>
      <span class="shrink-0 text-right text-xs tabular-nums text-muted">
        <span class="font-medium text-highlighted">{{ formatKcal(food.kcal) }}</span>
        <span class="block text-[10px] text-dimmed">/100 {{ food.base_unit }}</span>
      </span>
    </button>

    <UButton
      icon="i-lucide-star"
      size="sm"
      :color="food.favourite ? 'warning' : 'neutral'"
      :variant="food.favourite ? 'soft' : 'ghost'"
      square
      :class="food.favourite ? '' : 'text-dimmed'"
      :aria-label="food.favourite ? `Unstar ${food.name}` : `Star ${food.name}`"
      :aria-pressed="food.favourite"
      @click="emit('star', food)"
    />
    <UButton
      v-if="quick && last"
      icon="i-lucide-plus"
      size="sm"
      color="primary"
      variant="soft"
      square
      :loading="busy"
      :aria-label="`Add ${amountLabel(last.quantity, last.unit)} of ${food.name} again`"
      @click="emit('again', food as FoodPick)"
    />
  </div>
</template>
