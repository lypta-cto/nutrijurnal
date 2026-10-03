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
useSheetHistory(open)

const { createFood, updateFood } = useEating()
const toast = useToast()

/** The portions worth naming by hand — the rest are typed as grams anyway */
const PORTIONS: { unit: Unit, label: string, hint: string }[] = [
  { unit: 'piece', label: 'Piece', hint: 'one banana, one egg' },
  { unit: 'scoop', label: 'Scoop', hint: 'the tub\'s own scoop' },
  { unit: 'tbsp', label: 'Tablespoon', hint: 'a heaped spoon' },
  { unit: 'slice', label: 'Slice', hint: 'one slice of bread' }
]

/** What the numbers below are per: 100 g of a solid, 100 ml of a drink */
const BASE_UNITS: { value: 'g' | 'ml', label: string }[] = [
  { value: 'g', label: 'Grams' },
  { value: 'ml', label: 'Millilitres' }
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
const macroFields: { key: 'kcal' | 'protein' | 'carbs' | 'fat', label: string, unit: string, dot: string }[] = [
  { key: 'kcal', label: 'Kcal', unit: 'kcal', dot: 'bg-kcal' },
  { key: 'protein', label: 'Protein', unit: 'g', dot: 'bg-protein' },
  { key: 'carbs', label: 'Carbs', unit: 'g', dot: 'bg-carbs' },
  { key: 'fat', label: 'Fat', unit: 'g', dot: 'bg-fat' }
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
  <UDrawer
    v-model:open="open"
    :ui="SHEET_UI"
    :title="editing ? 'Edit food' : template ? 'Your own version' : 'New food'"
    :description="template
      ? `${template.name} is shared and stays as it is — this copy is yours to change.`
      : `What 100 ${form.base_unit} of it is worth, and what its portions weigh.`"
  >
    <template #body>
      <div
        class="flex flex-col gap-6"
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      >
        <!-- Health's way: each value on its own row, the label left and what
             is typed right-aligned against its unit -->
        <div class="app-card app-divide flex flex-col overflow-hidden">
          <ShellFieldRow
            label="Name"
            wide
          >
            <UInput
              v-model="form.name"
              placeholder="As on the packet"
              autofocus
              variant="none"
              :ui="FIELD_ROW_INPUT"
            />
          </ShellFieldRow>
          <ShellFieldRow
            label="Brand"
            wide
          >
            <UInput
              v-model="form.brand"
              placeholder="Optional"
              variant="none"
              :ui="FIELD_ROW_INPUT"
            />
          </ShellFieldRow>
        </div>

        <section
          class="flex flex-col gap-1.5"
          aria-labelledby="food-form-per-100"
        >
          <div class="flex items-center gap-3 pl-4">
            <h3
              id="food-form-per-100"
              class="app-group-title min-w-0 flex-1"
            >
              Per 100 {{ form.base_unit }}
            </h3>
            <ShellSegmented
              v-model="form.base_unit"
              label="Measured in"
              size="sm"
              :options="BASE_UNITS"
              class="w-52 shrink-0"
            />
          </div>

          <div class="app-card app-divide flex flex-col overflow-hidden">
            <ShellFieldRow
              v-for="field in macroFields"
              :key="field.key"
              :label="field.label"
              :unit="field.unit"
              :dot="field.dot"
            >
              <DecimalInput
                v-model="form[field.key]"
                variant="none"
                :ui="FIELD_ROW_INPUT"
              />
            </ShellFieldRow>
          </div>
        </section>

        <section
          class="flex flex-col gap-1.5"
          aria-labelledby="food-form-portions"
        >
          <h3
            id="food-form-portions"
            class="app-group-title px-4"
          >
            Portions — grams each
          </h3>
          <div class="app-card app-divide flex flex-col overflow-hidden">
            <ShellFieldRow
              v-for="portion in PORTIONS"
              :key="portion.unit"
              :label="portion.label"
              :hint="portion.hint"
              unit="g"
            >
              <DecimalInput
                v-model="portions[portion.unit]"
                placeholder="—"
                variant="none"
                :ui="FIELD_ROW_INPUT"
              />
            </ShellFieldRow>
          </div>
        </section>

        <p
          v-if="barcode"
          class="app-card flex items-start gap-3 px-4 py-3 text-footnote text-muted"
        >
          <UIcon
            name="i-lucide-barcode"
            class="mt-px size-4.5 shrink-0 text-muted"
          />
          <span>
            <span class="font-semibold text-default tabular-nums">{{ barcode }}</span>
            — saved with the food, so the next scan finds it.
          </span>
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center gap-2">
        <UButton
          v-if="editing"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          square
          size="lg"
          aria-label="Remove the food"
          :disabled="saving"
          @click="remove"
        />
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          size="lg"
          :disabled="saving"
          @click="open = false"
        />
        <UButton
          :label="editing ? 'Save food' : 'Add food'"
          size="lg"
          class="flex-1 justify-center"
          :loading="saving"
          :disabled="!payload.name"
          @click="save"
        />
      </div>
    </template>
  </UDrawer>
</template>
