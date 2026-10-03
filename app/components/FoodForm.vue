<script setup lang="ts">
import type { Food, FoodPayload, Unit } from '~/composables/useEating'

/**
 * A food, as the diary holds it: a name, what 100 g (or 100 ml) of it is
 * worth, and what its everyday portions weigh — a scoop, a piece, a spoon.
 * The same small form adds a new food and corrects one of your own.
 *
 * The shared staples can't be edited by anyone; opening one here starts
 * your own version of it instead (`template`), which is then yours to change.
 */
const props = withDefaults(defineProps<{
  /** Your own food being corrected; null = a new one */
  food?: Food | null
  /** A shared food to start your own version from */
  template?: Food | null
  /** A barcode a scan found but no food matched */
  barcode?: string | null
  /** A name to start from — the words a search or the parser could not place */
  name?: string
}>(), {
  food: null,
  template: null,
  barcode: null,
  name: ''
})

const emit = defineEmits<{ saved: [Food], removed: [Food] }>()
const open = defineModel<boolean>('open', { default: false })

const { createFood, updateFood } = useEating()
const toast = useToast()

/** The portions worth naming by hand — the rest are typed as grams anyway */
const PORTIONS: { unit: Unit, label: string, hint: string }[] = [
  { unit: 'piece', label: 'Piece', hint: 'one banana, one egg' },
  { unit: 'scoop', label: 'Scoop', hint: 'the tub\'s own scoop' },
  { unit: 'tbsp', label: 'Tablespoon', hint: 'a heaped spoon' },
  { unit: 'slice', label: 'Slice', hint: 'one slice of bread' }
]

const form = reactive({
  name: '',
  brand: '',
  base_unit: 'g' as 'g' | 'ml',
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0
})
// Empty is `undefined`, never null — an empty number field has no value at all
const portions = reactive<Record<string, number | undefined>>({})
const saving = ref(false)

const editing = computed(() => props.food !== null)

function reset() {
  const row = props.food ?? props.template
  Object.assign(form, {
    // A copy keeps the shared food's name — the Mine pill tells the two apart
    name: row?.name ?? props.name,
    brand: row?.brand ?? '',
    base_unit: row?.base_unit ?? 'g',
    kcal: row?.kcal ?? 0,
    protein: row?.protein ?? 0,
    carbs: row?.carbs ?? 0,
    fat: row?.fat ?? 0
  })
  for (const portion of PORTIONS) {
    portions[portion.unit] = row?.units?.[portion.unit] ?? undefined
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    reset()
  }
}, { immediate: true })

// One colour per macro, the same as the scoreboard and every diary row
const macroFields: { key: 'kcal' | 'protein' | 'carbs' | 'fat', label: string, dot: string }[] = [
  { key: 'kcal', label: 'kcal', dot: 'bg-emerald-500' },
  { key: 'protein', label: 'Protein', dot: 'bg-sky-500' },
  { key: 'carbs', label: 'Carbs', dot: 'bg-violet-500' },
  { key: 'fat', label: 'Fat', dot: 'bg-amber-500' }
]

const payload = computed<FoodPayload>(() => {
  const units: Partial<Record<Unit, number>> = {}
  for (const portion of PORTIONS) {
    const grams = portions[portion.unit]
    if (grams !== undefined && grams > 0) {
      units[portion.unit] = grams
    }
  }
  return {
    name: form.name.trim(),
    brand: form.brand.trim() || null,
    base_unit: form.base_unit,
    kcal: Number(form.kcal) || 0,
    protein: Number(form.protein) || 0,
    carbs: Number(form.carbs) || 0,
    fat: Number(form.fat) || 0,
    units,
    ...(props.barcode && !editing.value ? { barcode: props.barcode } : {})
  }
})

async function save() {
  if (!payload.value.name || saving.value) {
    return
  }
  saving.value = true
  try {
    const saved = props.food
      ? await updateFood(props.food.id, payload.value)
      : await createFood(payload.value)
    emit('saved', saved)
    open.value = false
    toast.add({
      title: editing.value ? 'Food updated' : `${saved.name} added`,
      icon: 'i-lucide-carrot',
      color: 'success'
    })
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}

/** Put away, not destroyed: past meals and recipes still point at it, and
 *  the toast's Undo takes it out again */
async function remove() {
  const food = props.food
  if (!food) {
    return
  }
  try {
    emit('removed', await updateFood(food.id, { archived: true }))
    open.value = false
    toast.add({
      title: `${food.name} removed`,
      description: 'Meals already eaten keep their numbers.',
      icon: 'i-lucide-trash-2',
      color: 'neutral',
      actions: [{
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: async () => {
          try {
            emit('saved', await updateFood(food.id, { archived: false }))
          } catch (error) {
            toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
          }
        }
      }]
    })
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing ? 'Edit food' : template ? 'Your own version' : 'New food'"
    :description="template
      ? `${template.name} is shared and stays as it is — this copy is yours to change.`
      : `What 100 ${form.base_unit} of it is worth, and what its portions weigh.`"
  >
    <template #body>
      <div
        class="flex flex-col gap-4"
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      >
        <UFormField label="Name">
          <UInput
            v-model="form.name"
            placeholder="What it is called on the packet"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField
          label="Brand"
          hint="optional"
        >
          <UInput
            v-model="form.brand"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Measured in"
          :hint="`macros below are per 100 ${form.base_unit}`"
        >
          <div class="flex w-max items-center gap-0.5 rounded-lg bg-elevated/70 p-0.5">
            <button
              v-for="unit in (['g', 'ml'] as const)"
              :key="unit"
              type="button"
              class="rounded-md px-4 py-1.5 text-xs font-medium transition-colors"
              :class="form.base_unit === unit ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-default'"
              :aria-pressed="form.base_unit === unit"
              @click="form.base_unit = unit"
            >
              {{ unit }}
            </button>
          </div>
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField
            v-for="field in macroFields"
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
              v-model.number="form[field.key]"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.1"
              class="w-full"
              :ui="{ base: 'tabular-nums text-right' }"
            />
          </UFormField>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-dimmed">Portions — grams each</span>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              v-for="portion in PORTIONS"
              :key="portion.unit"
              :label="portion.label"
              :hint="portion.hint"
            >
              <UInput
                v-model.number="portions[portion.unit]"
                type="number"
                inputmode="decimal"
                min="0"
                step="1"
                placeholder="—"
                class="w-full"
                :ui="{ base: 'tabular-nums' }"
              />
            </UFormField>
          </div>
        </div>

        <p
          v-if="barcode"
          class="flex items-center gap-1.5 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-barcode"
            class="size-3.5"
          />
          <span class="tabular-nums">{{ barcode }}</span>
          <span class="text-dimmed">— saved with the food, so the next scan finds it</span>
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center gap-2">
        <UButton
          v-if="editing"
          label="Remove"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="saving"
          @click="remove"
        />
        <div class="ml-auto flex gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="saving"
            @click="open = false"
          />
          <UButton
            :label="editing ? 'Save food' : 'Add food'"
            :loading="saving"
            :disabled="!payload.name"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
