<script setup lang="ts">
import type { Food, FoodPick } from '~/composables/useEating'
import { amountLabel, formatKcal } from '~/composables/useEating'

/**
 * One food in a list you pick from: its name, what 100 g of it is worth, a
 * star, and — when it was eaten before — a "+" that writes it down again in
 * the same amount with one tap. The kcal keep one column down the list, so a
 * list of foods reads like a shelf of labels.
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
  <div class="flex min-h-14 items-center gap-1 pr-3">
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5 pr-1 pl-4 text-left outline-none transition-colors duration-120 ease-soft focus-visible:bg-elevated active:bg-accented motion-reduce:transition-none"
      @click="emit('pick', food)"
    >
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="line-clamp-2 text-body break-words text-highlighted">{{ food.name }}</span>
        <span class="flex min-w-0 items-baseline gap-2 text-footnote text-muted">
          <!-- The amount the "+" adds again, then whose it is and the brand -->
          <span
            v-if="last"
            class="shrink-0 font-medium text-default tabular-nums"
          >{{ amountLabel(last.quantity, last.unit) }}</span>
          <span
            v-if="food.mine"
            class="shrink-0"
          >Mine</span>
          <span
            v-if="!last && food.brand"
            class="min-w-0 truncate"
          >{{ food.brand }}</span>
          <ShellMacroLine
            :macros="food"
            :kcal="false"
            class="shrink-0"
          />
        </span>
      </span>
      <span class="flex w-14 shrink-0 flex-col items-end leading-tight tabular-nums">
        <span class="text-body font-medium text-highlighted">{{ formatKcal(food.kcal) }}</span>
        <span class="text-caption2 text-muted">/100 {{ food.base_unit }}</span>
      </span>
    </button>

    <UButton
      icon="i-lucide-star"
      size="sm"
      :color="food.favourite ? 'primary' : 'neutral'"
      variant="ghost"
      square
      class="app-hit"
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
      class="app-hit"
      :loading="busy"
      :aria-label="`Add ${amountLabel(last.quantity, last.unit)} of ${food.name} again`"
      @click="emit('again', food as FoodPick)"
    />
  </div>
</template>
