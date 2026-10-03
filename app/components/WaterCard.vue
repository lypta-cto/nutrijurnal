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
const haptics = useHaptics()

const water = ref<WaterDay | null>(null)
const busy = ref(false)
/** The day's glasses could not be read — never shown as none drunk */
const failed = ref(false)
const retrying = ref(false)

async function load() {
  const which = props.day
  try {
    const result = await loadWater(which)
    if (which === props.day) {
      water.value = result
      failed.value = false
    }
  } catch {
    if (which === props.day) {
      water.value = null
      failed.value = true
    }
  }
}

async function retry() {
  retrying.value = true
  try {
    await load()
  } finally {
    retrying.value = false
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
    haptics.tap()
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
  <ShellCard
    title="Water"
    icon="i-lucide-glass-water"
    icon-class="text-info"
    :hint="failed ? undefined : `${formatWater(drunk)} of ${formatWater(goal)}`"
    :is-empty="failed"
    aria-label="Water"
  >
    <template #empty>
      <ShellEmpty
        compact
        icon="i-lucide-wifi-off"
        title="The water didn't load"
        description="Nothing is lost — check the connection and try again."
      >
        <UButton
          label="Try again"
          size="sm"
          variant="soft"
          :loading="retrying"
          @click="retry"
        />
      </ShellEmpty>
    </template>

    <template
      v-if="reached && !failed"
      #actions
    >
      <span class="flex items-center gap-1 text-footnote font-medium text-info">
        <UIcon
          name="i-lucide-check"
          class="size-4"
        />
        Goal reached
      </span>
    </template>

    <div class="flex flex-col gap-3">
      <!-- The glasses are the buttons: the next empty one drinks, the last full one takes back.
           Plain glyphs rather than tiles: the buttons under them are already a grey row,
           and twelve glasses (the most drawn) still fit at 22 px -->
      <div
        class="flex gap-1"
        role="group"
        :aria-label="`Glasses — ${share}% of the water goal`"
      >
        <button
          v-for="entry in glasses"
          :key="entry.index"
          type="button"
          class="app-press flex h-11 max-w-12 min-w-0 flex-1 items-center justify-center rounded-tile outline-none transition-colors duration-200 ease-soft focus-visible:ring-2 focus-visible:ring-info active:bg-elevated disabled:opacity-60 motion-reduce:transition-none"
          :class="entry.full ? 'text-info' : 'text-dimmed'"
          :aria-label="entry.full ? `Take back a glass (${formatWater(glass)})` : `Drink a glass (${formatWater(glass)})`"
          :disabled="busy"
          @click="tapGlass(entry)"
        >
          <UIcon
            name="i-lucide-glass-water"
            class="size-5.5 transition-transform duration-300 ease-spring motion-reduce:transition-none"
            :class="entry.full ? 'scale-100' : 'scale-90'"
          />
        </button>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-minus"
          color="neutral"
          variant="soft"
          square
          :disabled="busy || !water?.entries.length"
          aria-label="Take back the last glass"
          @click="takeBack"
        />
        <UButton
          :label="`+${formatWater(glass)}`"
          icon="i-lucide-glass-water"
          color="neutral"
          variant="soft"
          class="flex-1 justify-center tabular-nums"
          :ui="{ leadingIcon: 'text-info' }"
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
            variant="soft"
            square
            aria-label="Another amount"
          />
        </UDropdownMenu>
      </div>
    </div>
  </ShellCard>
</template>
