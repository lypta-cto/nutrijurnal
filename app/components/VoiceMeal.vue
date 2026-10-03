<script setup lang="ts">
import type { Meal } from '~/composables/useEating'
import { clockOf } from '~/composables/useVoiceNote'

/**
 * A meal said out loud while the hands are busy.
 *
 * Tap, talk, tap again. What comes back is a meal on the day with the words
 * as its note — to be counted later, the same way a typed note is — and the
 * recording hung on it, so nothing is lost when the browser cannot write the
 * words down (a phone often cannot).
 */
const props = defineProps<{
  /** The day the diary is showing */
  day: string
}>()

const emit = defineEmits<{ saved: [Meal] }>()

const { addMeal, attachVoice } = useEating()
const { supported, canTranscribe, recording, seconds, transcript, error, start, stop, cancel }
  = useVoiceNote()
const toast = useToast()

const saving = ref(false)

/** The first words make a better title than "Voice note" ever would */
function titleOf(words: string): string {
  const said = words.trim()
  if (!said) {
    return 'Voice note'
  }
  const short = said.split(/\s+/).slice(0, 6).join(' ')
  return (short.length < said.length ? `${short}…` : short).slice(0, 160)
}

async function begin() {
  if (!(await start())) {
    toast.add({ title: error.value ?? 'Cannot record', icon: 'i-lucide-mic-off', color: 'error' })
  }
}

async function finish() {
  const take = await stop()
  if (!take || !take.blob.size) {
    return
  }

  saving.value = true
  try {
    // The meal exists first: if the upload then fails, the words are already
    // safe on the day rather than lost with the recording.
    const meal = await addMeal({
      day: props.day,
      title: titleOf(take.transcript),
      note: take.transcript || null,
      items: []
    })

    let saved = meal
    try {
      saved = await attachVoice(meal.id, {
        blob: take.blob,
        seconds: take.seconds,
        transcribed: Boolean(take.transcript)
      })
    } catch (audioError) {
      toast.add({
        title: 'The words are saved, the recording is not',
        description: apiErrorMessage(audioError),
        icon: 'i-lucide-triangle-alert',
        color: 'warning'
      })
    }

    emit('saved', saved)
    toast.add({
      title: take.transcript ? 'Written down as said' : `Recorded — ${clockOf(take.seconds)}`,
      description: take.transcript
        ? 'Check the words, then fill in what it was.'
        : 'This browser could not write it down — listen back and fill it in.',
      icon: 'i-lucide-mic',
      color: 'success'
    })
  } catch (saveError) {
    toast.add({ title: apiErrorMessage(saveError), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-2 text-center">
    <template v-if="!recording">
      <UButton
        icon="i-lucide-mic"
        size="xl"
        class="size-20 justify-center rounded-full"
        :ui="{ leadingIcon: 'size-8' }"
        :loading="saving"
        :disabled="!supported"
        aria-label="Start recording"
        @click="begin"
      />
      <p class="max-w-xs text-sm text-muted">
        <template v-if="!supported">
          This browser can't record audio.
        </template>
        <template v-else-if="canTranscribe">
          Tap and say what you ate. It's written down as you talk, and the recording is kept.
        </template>
        <template v-else>
          Tap and say what you ate. This browser can't write it down, so the recording is kept to count later.
        </template>
      </p>
    </template>

    <!-- Recording: the one thing that matters is that it is on -->
    <template v-else>
      <div class="flex items-center gap-2">
        <span class="size-2.5 shrink-0 animate-pulse rounded-full bg-error" />
        <span class="text-2xl font-semibold tabular-nums text-error">{{ clockOf(seconds) }}</span>
      </div>
      <p
        class="min-h-10 max-w-xs text-sm"
        :class="transcript ? 'text-default' : 'text-dimmed'"
      >
        {{ transcript || 'Listening…' }}
      </p>
      <div class="flex items-center gap-3">
        <UButton
          label="Discard"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          @click="cancel"
        />
        <UButton
          label="Save"
          icon="i-lucide-square"
          color="error"
          :loading="saving"
          @click="finish"
        />
      </div>
    </template>
  </div>
</template>
