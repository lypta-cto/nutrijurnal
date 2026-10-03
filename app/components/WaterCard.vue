<script setup lang="ts">
import type { WaterDay } from '~/composables/useBody'
import { formatWater } from '~/composables/useBody'

/**
 * The day's water, one glass at a time. The glasses are the buttons: tap
 * the next empty one to drink it, the last full one to take it back. The
 * "+" adds the person's own glass size; other amounts are one menu away.
 */
const props = defineProps<{
  day: string
}>()

const emit = defineEmits<{ changed: [WaterDay] }>()

const { loadWater, addWater, removeWater } = useBody()
const toast = useToast()

const water = ref<WaterDay | null>(null)
const busy = ref(false)

async function load() {
  const which = props.day
  try {
    const result = await loadWater(which)
    if (which === props.day) {
      water.value = result
    }
  } catch {
    water.value = null
  }
}

watch(() => props.day, () => void load(), { immediate: true })

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

async function add(ml: number) {
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    water.value = await addWater(props.day, ml)
    navigator.vibrate?.(15)
    emit('changed', water.value)
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

async function takeBack() {
  const last = water.value?.entries.at(-1)
  if (!last || busy.value) {
    return
  }
  busy.value = true
  try {
    water.value = await removeWater(last.id)
    emit('changed', water.value)
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

const glass = computed(() => water.value?.glass_ml ?? 250)
const goal = computed(() => water.value?.goal_ml ?? 2000)
const drunk = computed(() => water.value?.ml ?? 0)
const share = computed(() => Math.min(100, Math.round((drunk.value / goal.value) * 100)))
const reached = computed(() => drunk.value >= goal.value)

/** The glasses the goal is made of — capped, so a big goal still fits a row */
const MAX_GLASSES = 12
const glasses = computed(() => {
  const count = Math.min(MAX_GLASSES, Math.max(1, Math.ceil(goal.value / glass.value)))
  const full = Math.floor(drunk.value / glass.value)
  return Array.from({ length: count }, (_, index) => ({ index, full: index < full }))
})

function tapGlass(entry: { index: number, full: boolean }) {
  if (entry.full) {
    void takeBack()
  } else {
    void add(glass.value)
  }
}

const OTHER_AMOUNTS = [150, 330, 500, 750]

const moreItems = computed(() => [OTHER_AMOUNTS.map(ml => ({
  label: `+${formatWater(ml)}`,
  icon: 'i-lucide-glass-water',
  onSelect: () => void add(ml)
}))])
</script>

<template>
  <section
    class="app-card flex flex-col gap-3 px-4 py-3"
    aria-label="Water"
  >
    <header class="flex items-center gap-2">
      <UIcon
        name="i-lucide-droplet"
        class="size-4 shrink-0 text-info"
      />
      <h2 class="text-sm font-semibold text-highlighted">
        Water
      </h2>
      <span class="text-xs tabular-nums text-muted">
        <span class="font-medium text-default">{{ formatWater(drunk) }}</span> of {{ formatWater(goal) }}
      </span>
      <UBadge
        v-if="reached"
        label="Goal reached"
        icon="i-lucide-check"
        color="success"
        variant="soft"
        size="sm"
        class="ml-auto"
      />
    </header>

    <div
      class="flex flex-wrap gap-1"
      role="group"
      aria-label="Glasses"
    >
      <button
        v-for="entry in glasses"
        :key="entry.index"
        type="button"
        class="flex size-8 items-center justify-center rounded-lg transition-colors active:scale-95"
        :class="entry.full ? 'bg-info/15 text-info' : 'bg-elevated text-dimmed'"
        :aria-label="entry.full ? `Take back a glass (${formatWater(glass)})` : `Drink a glass (${formatWater(glass)})`"
        :disabled="busy"
        @click="tapGlass(entry)"
      >
        <UIcon
          name="i-lucide-glass-water"
          class="size-4"
        />
      </button>
    </div>

    <UProgress
      :model-value="share"
      color="info"
      size="sm"
      :aria-label="`${share}% of the water goal`"
    />

    <div class="flex items-center gap-2">
      <UButton
        icon="i-lucide-minus"
        color="neutral"
        variant="subtle"
        square
        :disabled="busy || !water?.entries.length"
        aria-label="Take back the last glass"
        @click="takeBack"
      />
      <UButton
        :label="`+${formatWater(glass)}`"
        icon="i-lucide-glass-water"
        color="info"
        class="flex-1 justify-center"
        :loading="busy"
        @click="add(glass)"
      />
      <UDropdownMenu
        :items="moreItems"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="subtle"
          square
          aria-label="Another amount"
        />
      </UDropdownMenu>
    </div>
  </section>
</template>
