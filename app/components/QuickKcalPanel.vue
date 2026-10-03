<script setup lang="ts">
import type { Macros, Slot } from '~/composables/useEating'
import { MACRO_BARS, slotLabel } from '~/composables/useEating'

/**
 * A plate nobody can weigh, known by its numbers: the kcal, the macros if
 * they are on the label, and what it was. Written down as one serving.
 */
const props = withDefaults(defineProps<{
  mealSlot: Slot
  adding?: boolean
}>(), {
  adding: false
})

const emit = defineEmits<{
  add: [{ label: string, macros: Macros }]
  back: []
}>()

const label = ref('')
const numbers = reactive<Record<keyof Macros, number | undefined>>({ kcal: undefined, protein: undefined, carbs: undefined, fat: undefined })

function valueOf(value: number | undefined): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

const kcal = computed(() => valueOf(numbers.kcal))

/** The macros a label printed, if the kcal is missing, still say what it was */
const fromMacros = computed(() =>
  Math.round(valueOf(numbers.protein) * 4 + valueOf(numbers.carbs) * 4 + valueOf(numbers.fat) * 9))

function submit() {
  const total = kcal.value || fromMacros.value
  if (total <= 0 || props.adding) {
    return
  }
  emit('add', {
    label: label.value.trim() || 'Quick add',
    macros: {
      kcal: total,
      protein: valueOf(numbers.protein),
      carbs: valueOf(numbers.carbs),
      fat: valueOf(numbers.fat)
    }
  })
}
</script>

<template>
  <form
    class="flex flex-col gap-4"
    @submit.prevent="submit"
  >
    <div class="flex items-center gap-2">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        square
        aria-label="Back to the list"
        @click="emit('back')"
      />
      <p class="font-semibold text-highlighted">
        Quick kcal
      </p>
    </div>

    <UFormField label="Kcal">
      <UInput
        v-model.number="numbers.kcal"
        type="number"
        inputmode="numeric"
        min="0"
        size="xl"
        autofocus
        :placeholder="fromMacros ? String(fromMacros) : '350'"
        class="w-full"
        :ui="{ base: 'tabular-nums text-2xl font-semibold' }"
      />
    </UFormField>

    <div class="grid grid-cols-3 gap-2">
      <UFormField
        v-for="bar in MACRO_BARS"
        :key="bar.key"
        :label="`${bar.label} g`"
        hint="optional"
        :ui="{ hint: 'text-[10px]' }"
      >
        <UInput
          v-model.number="numbers[bar.key]"
          type="number"
          inputmode="decimal"
          min="0"
          placeholder="—"
          class="w-full"
          :ui="{ base: 'tabular-nums' }"
        />
      </UFormField>
    </div>

    <UFormField
      label="What was it?"
      hint="optional"
    >
      <UInput
        v-model="label"
        placeholder="Slice of cake at the office"
        class="w-full"
      />
    </UFormField>

    <UButton
      type="submit"
      :label="`Add to ${slotLabel(mealSlot)}`"
      icon="i-lucide-plus"
      size="lg"
      block
      :loading="adding"
      :disabled="!kcal && !fromMacros"
    />
  </form>
</template>
