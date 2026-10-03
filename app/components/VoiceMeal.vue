<script setup lang="ts">
import type { Macros, Meal, MealItemPayload, ParsedItem, Slot } from '~/composables/useEating'
import { SLOTS, amountLabel, formatKcal, macrosOf, scaleMacros, slotLabel } from '~/composables/useEating'
import { DICTATION_LANGUAGES, clockOf, useDictationLanguage } from '~/composables/useVoiceNote'

/**
 * A meal said out loud while the hands are busy — "dodaj 200 g piletine i
 * 100 g pirinča za ručak", "two eggs and toast for breakfast".
 *
 * Tap, talk, tap again. The words (dictated where the browser can, typed
 * where it cannot) are read into a draft: the foods with their amounts and
 * the slot the sentence named. Nothing is saved until the draft has been
 * looked at; the recording is kept on the meal either way, so a phone that
 * cannot dictate loses nothing.
 */
const props = defineProps<{
  /** The day the diary is showing */
  day: string
  /** The slot the sheet was opened on — the sentence may name another */
  mealSlot: Slot
}>()

const emit = defineEmits<{ saved: [Meal] }>()

const { addMeal, attachVoice, parseText } = useEating()
const voice = useVoiceNote()
const { supported, canTranscribe, seconds, transcript, error, dictationFailed } = voice
const language = useDictationLanguage()
const toast = useToast()
const haptics = useHaptics()

type Stage = 'ready' | 'recording' | 'draft'
const stage = ref<Stage>('ready')

/** What was said, as text the person can correct before it is read */
const words = ref('')
const take = ref<{ blob: Blob, seconds: number, transcribed: boolean } | null>(null)

interface DraftItem extends ParsedItem {
  key: number
  /** The amount the numbers were read for — they scale with it */
  baseQuantity: number
  baseMacros: Macros
}

const items = ref<DraftItem[]>([])
const unknown = ref<string[]>([])
const slot = ref<Slot>(props.mealSlot)
const reading = ref(false)
const saving = ref(false)
let nextKey = 0

async function begin() {
  if (!(await voice.start(language.value))) {
    toast.add({ title: error.value ?? 'Cannot record', icon: 'i-lucide-mic-off', color: 'error' })
    return
  }
  stage.value = 'recording'
}

async function finish() {
  const recorded = await voice.stop()
  if (!recorded || !recorded.blob.size) {
    stage.value = 'ready'
    return
  }
  take.value = { blob: recorded.blob, seconds: recorded.seconds, transcribed: Boolean(recorded.transcript) }
  words.value = recorded.transcript
  stage.value = 'draft'
  if (recorded.transcript) {
    await read()
  }
}

function discard() {
  voice.cancel()
  take.value = null
  words.value = ''
  items.value = []
  unknown.value = []
  stage.value = 'ready'
}

/** Typing instead of talking: the same draft, no recording */
function typeInstead() {
  take.value = null
  words.value = ''
  items.value = []
  unknown.value = []
  stage.value = 'draft'
}

/** The read in flight — saving waits for it instead of racing it */
let inFlight: Promise<void> | null = null

function read(): Promise<void> {
  const text = words.value.trim()
  if (!text) {
    return Promise.resolve()
  }
  inFlight ??= parse(text).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function parse(text: string) {
  reading.value = true
  try {
    const result = await parseText(text)
    items.value = result.items.map(item => ({
      ...item,
      key: (nextKey += 1),
      baseQuantity: item.quantity,
      baseMacros: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat }
    }))
    unknown.value = result.unknown
    if (result.slot) {
      slot.value = result.slot
    }
  } catch (failure) {
    toast.add({ title: apiErrorMessage(failure), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    reading.value = false
  }
}

function macrosOfItem(item: DraftItem): Macros {
  return item.baseQuantity > 0 ? scaleMacros(item.baseMacros, (Number(item.quantity) || 0) / item.baseQuantity) : item.baseMacros
}

const totals = computed(() => macrosOf(items.value.map(macrosOfItem)))

function drop(item: DraftItem) {
  items.value = items.value.filter(entry => entry.key !== item.key)
}

/** Words the parser could not place stay on the plate as words, counted later */
function keepAsWritten(chunk: string) {
  items.value = [...items.value, {
    key: (nextKey += 1),
    food_id: null,
    label: chunk,
    quantity: 1,
    unit: 'piece',
    grams: 0,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    baseQuantity: 1,
    baseMacros: { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  }]
  unknown.value = unknown.value.filter(entry => entry !== chunk)
}

const canSave = computed(() => items.value.length > 0 || Boolean(words.value.trim()) || Boolean(take.value))

async function save() {
  if (!canSave.value || saving.value) {
    return
  }
  saving.value = true
  try {
    // "Done" then "Save" in one breath: the words are still being read, and
    // the foods in them belong on this meal — not lost to a bare note
    await inFlight
    const said = words.value.trim()
    const payload: MealItemPayload[] = items.value.map(item => ({
      food_id: item.food_id,
      label: item.label,
      quantity: Number(item.quantity) || 0,
      unit: item.unit
    }))
    // The meal exists first: if the upload then fails, the words are already
    // safe on the day rather than lost with the recording
    let meal = await addMeal({
      day: props.day,
      slot: slot.value,
      note: said || null,
      items: payload
    })
    if (take.value) {
      try {
        meal = await attachVoice(meal.id, { ...take.value, transcribed: take.value.transcribed && Boolean(said) })
      } catch (audioError) {
        toast.add({
          title: 'The meal is saved, the recording is not',
          description: apiErrorMessage(audioError),
          icon: 'i-lucide-triangle-alert',
          color: 'warning'
        })
      }
    }
    haptics.success()
    emit('saved', meal)
    toast.add({
      title: payload.length ? `${meal.title} added to ${slotLabel(meal.slot)}` : `Written down for ${slotLabel(meal.slot)}`,
      description: payload.length
        ? `${formatKcal(meal.kcal)} kcal`
        : 'Fill in the amounts whenever you like — the recording is on the meal.',
      icon: 'i-lucide-mic',
      color: 'success'
    })
  } catch (failure) {
    toast.add({ title: apiErrorMessage(failure), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}

/** Dictation stopped on its own while the recording went on */
const dictationNote = computed(() => {
  if (!dictationFailed.value) {
    return null
  }
  return dictationFailed.value === 'language-not-supported'
    ? 'This device cannot dictate in that language — try the other one, or type what you said.'
    : 'Dictation stopped part-way. The recording is kept — check the words, or type them.'
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Ready: the one big button, and what will happen -->
    <template v-if="stage === 'ready'">
      <ShellSegmented
        v-model="language"
        label="Dictation language"
        size="sm"
        :options="DICTATION_LANGUAGES"
        class="w-56 self-center"
      />

      <div class="flex flex-col items-center gap-4 py-3 text-center">
        <button
          type="button"
          class="flex size-20 items-center justify-center rounded-full bg-primary text-inverted outline-none transition-transform duration-120 ease-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary enabled:active:scale-95 disabled:opacity-50 motion-reduce:transition-none"
          :disabled="!supported"
          aria-label="Start recording"
          @click="begin"
        >
          <UIcon
            name="i-lucide-mic"
            class="size-9"
          />
        </button>
        <p class="max-w-xs text-subheadline text-muted">
          <template v-if="!supported">
            This browser can't record audio. Type what you ate instead.
          </template>
          <template v-else>
            Tap and say it: <span class="font-medium text-default">“200 g chicken and rice for lunch”</span>.
          </template>
        </p>
      </div>

      <UAlert
        v-if="supported && !canTranscribe"
        color="warning"
        variant="subtle"
        icon="i-lucide-mic-off"
        title="Dictation isn't available on this device"
        description="Your words can't be written down here, so the recording is kept on the meal to fill in later — or type it below."
      />

      <UButton
        label="Type it instead"
        icon="i-lucide-keyboard"
        color="neutral"
        variant="ghost"
        class="self-center"
        @click="typeInstead"
      />
    </template>

    <!-- Recording: the one thing that matters is that it is on -->
    <div
      v-else-if="stage === 'recording'"
      class="flex flex-col items-center gap-5 py-3 text-center"
      role="status"
    >
      <!-- Voice Memos' way: a red dot and the time running -->
      <div class="flex items-center gap-2.5">
        <span
          class="size-3 rounded-full bg-error motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <span class="font-rounded text-title text-highlighted tabular-nums">{{ clockOf(seconds) }}</span>
      </div>
      <p
        class="min-h-10 max-w-xs text-body"
        :class="transcript ? 'text-default' : 'text-dimmed'"
      >
        {{ transcript || (canTranscribe ? 'Listening…' : 'Recording — dictation is not available here.') }}
      </p>
      <div class="flex w-full gap-2">
        <UButton
          label="Discard"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="lg"
          @click="discard"
        />
        <UButton
          label="Done"
          icon="i-lucide-square"
          color="error"
          size="lg"
          class="flex-1 justify-center"
          @click="finish"
        />
      </div>
    </div>

    <!-- The draft: check it, then save it -->
    <template v-else>
      <UAlert
        v-if="dictationNote"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="dictationNote"
      />

      <div
        v-if="take"
        class="flex items-center gap-1.5 self-start text-footnote text-muted tabular-nums"
      >
        <UIcon
          name="i-lucide-audio-lines"
          class="size-4"
        />
        Recording kept · {{ clockOf(take.seconds) }}
      </div>

      <UFormField
        :label="take?.transcribed ? 'What you said' : 'What you ate'"
        :hint="take && !take.transcribed ? 'not dictated' : undefined"
      >
        <UTextarea
          v-model="words"
          :rows="2"
          autoresize
          :autofocus="!take?.transcribed"
          placeholder="200 g chicken and 100 g rice for lunch"
          class="w-full"
          @keydown.enter.exact.prevent="read"
        />
      </UFormField>
      <UButton
        label="Read it again"
        icon="i-lucide-refresh-cw"
        size="sm"
        variant="ghost"
        class="self-end"
        :loading="reading"
        :disabled="!words.trim()"
        @click="read"
      />

      <ShellSegmented
        v-model="slot"
        label="Meal"
        size="sm"
        :options="SLOTS.map(entry => ({ value: entry.value, label: entry.label }))"
      />

      <div
        v-if="items.length"
        class="app-card app-divide flex flex-col overflow-hidden"
      >
        <div
          v-for="item in items"
          :key="item.key"
          class="grid grid-cols-[4.5rem_minmax(0,1fr)_auto_2rem] items-center gap-3 py-2.5 pr-2 pl-3"
        >
          <DecimalInput
            v-model="item.quantity"
            size="sm"
            :ui="{ base: 'tabular-nums text-right' }"
            :aria-label="`Amount of ${item.label}`"
          />
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-body text-highlighted">{{ item.label }}</span>
            <span class="text-footnote text-muted tabular-nums">{{ amountLabel(Number(item.quantity) || 0, item.unit) }}</span>
          </span>
          <span class="flex flex-col items-end leading-tight tabular-nums">
            <span class="text-subheadline font-medium text-highlighted">{{ formatKcal(macrosOfItem(item).kcal) }}</span>
            <span class="text-caption2 text-muted">kcal</span>
          </span>
          <UButton
            icon="i-lucide-x"
            size="sm"
            color="neutral"
            variant="ghost"
            square
            class="app-hit text-dimmed"
            :aria-label="`Remove ${item.label}`"
            @click="drop(item)"
          />
        </div>
        <div class="flex items-baseline justify-between px-3 py-2.5">
          <span class="text-subheadline font-semibold text-default">Total</span>
          <span class="text-subheadline font-semibold text-highlighted tabular-nums">{{ formatKcal(totals.kcal) }} kcal</span>
        </div>
      </div>

      <div
        v-if="unknown.length"
        class="flex flex-col"
      >
        <span class="app-group-title px-4 pb-1.5">Not recognised</span>
        <div class="app-card app-divide flex flex-col overflow-hidden">
          <div
            v-for="chunk in unknown"
            :key="chunk"
            class="flex min-h-11 items-center gap-2 py-1 pr-2 pl-4"
          >
            <UIcon
              name="i-lucide-circle-help"
              class="size-4.5 shrink-0 text-warning"
            />
            <span class="min-w-0 flex-1 truncate text-body text-default">{{ chunk }}</span>
            <UButton
              label="Keep as written"
              size="sm"
              variant="ghost"
              @click="keepAsWritten(chunk)"
            />
          </div>
        </div>
      </div>

      <p
        v-if="!items.length && !unknown.length && !reading && words.trim()"
        class="text-footnote text-muted"
      >
        Tap “Read it again” to find the foods — or save the words as they are and count them later.
      </p>

      <div class="flex gap-2">
        <UButton
          label="Discard"
          color="neutral"
          variant="ghost"
          size="lg"
          :disabled="saving"
          @click="discard"
        />
        <UButton
          :label="items.length ? `Add to ${slotLabel(slot)}` : 'Save for later'"
          icon="i-lucide-check"
          size="lg"
          class="flex-1 justify-center"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        />
      </div>
    </template>
  </div>
</template>
