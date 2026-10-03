<script setup lang="ts">
import type { Food, FoodPick, Macros, Slot, Unit } from '~/composables/useEating'
import { MACRO_BARS, amountLabel, formatKcal, formatMacro, gramsFor, macrosFromFood, slotLabel, unitLabel, unitsOf } from '~/composables/useEating'

/**
 * How much of a picked food: an amount, a unit, and what that comes to —
 * live, before anything is written down. Common amounts are one tap away,
 * the last one first.
 */
const props = withDefaults(defineProps<{
  food: Food | FoodPick
  mealSlot: Slot
  adding?: boolean
}>(), {
  adding: false
})

const emit = defineEmits<{
  add: [{ quantity: number, unit: Unit }]
  back: []
}>()

const units = computed(() => unitsOf(props.food))

function startingAmount(): { quantity: number, unit: Unit } {
  const food = props.food as FoodPick
  if (food.last_quantity && food.last_unit && units.value.includes(food.last_unit)) {
    return { quantity: food.last_quantity, unit: food.last_unit }
  }
  const named = units.value.find(unit => unit !== 'g' && unit !== 'ml')
  return named ? { quantity: 1, unit: named } : { quantity: 100, unit: props.food.base_unit }
}

const start = startingAmount()
const quantity = ref<number | undefined>(start.quantity)
const unit = ref<Unit>(start.unit)

const amount = computed(() => {
  const value = Number(quantity.value)
  return Number.isFinite(value) && value > 0 ? value : 0
})

const macros = computed<Macros | null>(() => {
  const grams = gramsFor(props.food, amount.value, unit.value)
  return grams === null ? null : macrosFromFood(props.food, grams)
})

const grams = computed(() => gramsFor(props.food, amount.value, unit.value))

/** One tap to the amounts people actually eat in */
const presets = computed<{ quantity: number, unit: Unit }[]>(() => {
  const out: { quantity: number, unit: Unit }[] = []
  const food = props.food as FoodPick
  if (food.last_quantity && food.last_unit && units.value.includes(food.last_unit)) {
    out.push({ quantity: food.last_quantity, unit: food.last_unit })
  }
  for (const named of units.value.filter(entry => entry !== 'g' && entry !== 'ml')) {
    out.push({ quantity: 1, unit: named }, { quantity: 2, unit: named })
  }
  const base = props.food.base_unit
  for (const value of base === 'ml' ? [100, 250, 330] : [50, 100, 150, 200]) {
    out.push({ quantity: value, unit: base })
  }
  const seen = new Set<string>()
  return out.filter((entry) => {
    const key = `${entry.quantity}|${entry.unit}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  }).slice(0, 6)
})

function choose(entry: { quantity: number, unit: Unit }) {
  quantity.value = entry.quantity
  unit.value = entry.unit
}

const unitItems = computed(() => units.value.map(entry => ({ value: entry, label: unitLabel(entry, amount.value || 1) })))

function submit() {
  if (amount.value > 0 && !props.adding) {
    emit('add', { quantity: amount.value, unit: unit.value })
  }
}
</script>

<template>
  <form
    class="flex flex-col gap-4"
    @submit.prevent="submit"
  >
    <div class="flex items-center gap-1">
      <UButton
        icon="i-lucide-chevron-left"
        variant="ghost"
        square
        class="-ml-3"
        :ui="{ leadingIcon: 'size-6' }"
        aria-label="Back to the list"
        @click="emit('back')"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-headline text-highlighted">
          {{ food.name }}
        </p>
        <p class="truncate text-footnote text-muted tabular-nums">
          <template v-if="food.brand">
            {{ food.brand }} ·
          </template>{{ formatKcal(food.kcal) }} kcal per 100 {{ food.base_unit }}
        </p>
      </div>
    </div>

    <!-- The amounts people actually eat in, one tap each -->
    <div
      class="flex flex-wrap gap-2"
      role="group"
      aria-label="Common amounts"
    >
      <button
        v-for="entry in presets"
        :key="`${entry.quantity}${entry.unit}`"
        type="button"
        class="app-chip tabular-nums"
        :aria-pressed="amount === entry.quantity && unit === entry.unit"
        @click="choose(entry)"
      >
        {{ amountLabel(entry.quantity, entry.unit) }}
      </button>
    </div>

    <div class="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-3">
      <UFormField label="Amount">
        <DecimalInput
          v-model="quantity"
          size="lg"
          fixed
          class="w-full"
          :ui="{ base: 'tabular-nums text-lg font-medium' }"
        />
      </UFormField>
      <UFormField label="Unit">
        <USelect
          v-model="unit"
          :items="unitItems"
          value-key="value"
          size="lg"
          class="w-full"
        />
      </UFormField>
    </div>

    <!-- What that comes to, live, before anything is written down -->
    <div
      class="app-card flex items-center gap-4 px-4 py-3.5"
      aria-live="polite"
    >
      <div class="flex shrink-0 flex-col">
        <span class="font-rounded text-title leading-none text-highlighted tabular-nums">{{ macros ? formatKcal(macros.kcal) : '—' }}</span>
        <span class="mt-1 text-footnote text-muted tabular-nums">kcal<template v-if="grams !== null && unit !== 'g' && unit !== 'ml'"> · {{ formatMacro(grams) }} g</template></span>
      </div>
      <div class="ml-auto grid grid-cols-3 gap-3">
        <span
          v-for="bar in MACRO_BARS"
          :key="bar.key"
          class="flex flex-col"
        >
          <span class="flex items-center gap-1 text-caption text-muted">
            <span
              class="size-1.5 rounded-full"
              :class="bar.dot"
            />
            {{ bar.label }}
          </span>
          <span class="text-subheadline font-medium text-highlighted tabular-nums">{{ macros ? formatMacro(macros[bar.key]) : '—' }} g</span>
        </span>
      </div>
    </div>

    <UButton
      type="submit"
      :label="`Add to ${slotLabel(mealSlot)}`"
      icon="i-lucide-plus"
      size="lg"
      block
      :loading="adding"
      :disabled="amount <= 0"
    />
  </form>
</template>
