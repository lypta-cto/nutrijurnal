<script setup lang="ts">
import type { WeightEntry } from '~/composables/useBody'
import { formatWeight } from '~/composables/useBody'
import { dayShort, shiftDay } from '~/composables/useEating'

/**
 * The scale, for the day on screen: weighed that day, the number and how it
 * moved over the week before; not weighed, the last number and a field to
 * write today's in. One number a day — saving again corrects it.
 */
const props = defineProps<{
  day: string
}>()

const emit = defineEmits<{ changed: [] }>()

const { weightRange, putWeight, removeWeight } = useBody()
const toast = useToast()
const haptics = useHaptics()

/** The month up to the day: enough for "last weighed" and the week's change */
const recent = ref<WeightEntry[]>([])
const loading = ref(false)
const editing = ref(false)
const typed = ref<number | undefined>(undefined)
const saving = ref(false)

async function load() {
  const which = props.day
  loading.value = true
  try {
    const found = await weightRange(shiftDay(which, -60), which)
    if (which === props.day) {
      recent.value = found
    }
  } catch {
    recent.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.day, () => {
  editing.value = false
  void load()
}, { immediate: true })

const onDay = computed(() => recent.value.find(entry => entry.day === props.day) ?? null)
const last = computed(() => recent.value.at(-1) ?? null)

/** Against the last weighing at least a week before — a day's swing is water */
const weekChange = computed(() => {
  if (!onDay.value) {
    return null
  }
  const weekAgo = shiftDay(props.day, -7)
  const before = [...recent.value].reverse().find(entry => entry.day <= weekAgo)
  return before ? Math.round((onDay.value.kg - before.kg) * 10) / 10 : null
})

function startEditing() {
  typed.value = onDay.value?.kg ?? last.value?.kg
  editing.value = true
}

async function save() {
  const kg = Number(typed.value)
  if (!Number.isFinite(kg) || kg < 20 || kg > 400 || saving.value) {
    toast.add({ title: 'Enter a weight between 20 and 400 kg', icon: 'i-lucide-circle-help', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await putWeight(props.day, Math.round(kg * 10) / 10)
    haptics.success()
    editing.value = false
    await load()
    emit('changed')
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove() {
  const entry = onDay.value
  if (!entry) {
    return
  }
  try {
    await removeWeight(entry.day)
    await load()
    emit('changed')
    toast.add({
      title: `${formatWeight(entry.kg)} removed`,
      icon: 'i-lucide-trash-2',
      color: 'neutral',
      actions: [{
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: async () => {
          await putWeight(entry.day, entry.kg).catch(() => {})
          await load()
          emit('changed')
        }
      }]
    })
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  }
}
</script>

<template>
  <ShellCard
    title="Weight"
    icon="i-lucide-scale"
    aria-label="Weight"
  >
    <template
      v-if="onDay && !editing"
      #actions
    >
      <UButton
        icon="i-lucide-pencil"
        size="sm"
        color="neutral"
        variant="ghost"
        square
        class="app-hit text-muted"
        aria-label="Correct the weight"
        @click="startEditing"
      />
      <UButton
        icon="i-lucide-trash-2"
        size="sm"
        color="neutral"
        variant="ghost"
        square
        class="app-hit text-muted"
        aria-label="Remove the weight"
        @click="remove"
      />
    </template>

    <ShellSkeleton
      v-if="loading && !recent.length"
      variant="text"
      :count="2"
      class="py-1"
    />

    <!-- The number in the strong colour, the change beside it in none:
         a kilo up or down is not good or bad news to colour -->
    <div
      v-else-if="onDay && !editing"
      class="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      <span class="flex items-baseline gap-1">
        <span class="text-[2rem] leading-none font-bold tracking-tight text-highlighted tabular-nums">{{ onDay.kg.toFixed(1) }}</span>
        <span class="text-sm font-semibold text-muted">kg</span>
      </span>
      <span
        v-if="weekChange !== null"
        class="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-xs font-semibold text-toned tabular-nums"
      >
        <UIcon
          :name="weekChange < 0 ? 'i-lucide-trending-down' : weekChange > 0 ? 'i-lucide-trending-up' : 'i-lucide-equal'"
          class="size-3.5"
        />
        {{ weekChange > 0 ? '+' : weekChange < 0 ? '−' : '' }}{{ Math.abs(weekChange).toFixed(1) }} kg in a week
      </span>
    </div>

    <form
      v-else
      class="flex flex-col gap-2.5"
      @submit.prevent="save"
    >
      <p
        v-if="!editing && last"
        class="text-sm text-muted"
      >
        Last weighed <span class="font-semibold text-default tabular-nums">{{ formatWeight(last.kg) }}</span> on {{ dayShort(last.day) }}.
      </p>
      <p
        v-else-if="!editing"
        class="text-sm text-muted"
      >
        Weigh in once a week or so — the trend shows up in Progress.
      </p>
      <div class="flex items-center gap-2">
        <UInput
          v-model.number="typed"
          type="number"
          inputmode="decimal"
          step="0.1"
          min="20"
          max="400"
          :placeholder="last ? last.kg.toFixed(1) : '70.0'"
          class="min-w-0 flex-1"
          :ui="{ base: 'tabular-nums', trailing: 'pointer-events-none' }"
          aria-label="Weight in kilograms"
          @focus="!editing && typed === undefined && (typed = last?.kg)"
        >
          <template #trailing>
            <span class="text-sm text-dimmed">kg</span>
          </template>
        </UInput>
        <UButton
          v-if="editing"
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="editing = false"
        />
        <UButton
          type="submit"
          label="Save"
          :loading="saving"
          :disabled="!typed"
        />
      </div>
    </form>
  </ShellCard>
</template>
