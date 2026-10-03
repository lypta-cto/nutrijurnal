<script setup lang="ts">
import type { Meal } from '~/composables/useEating'
import { clockOf } from '~/composables/useVoiceNote'

/**
 * The recording hanging on a meal: play it back while filling the meal in.
 *
 * The endpoint wants the bearer token, so this cannot be a plain `<audio src>`
 * — the bytes are fetched once, kept as an object URL for as long as the row
 * is on screen, and played from there.
 */
const props = defineProps<{ meal: Meal }>()
const emit = defineEmits<{ changed: [Meal] }>()

const { loadVoice, dropVoice } = useEating()
const toast = useToast()
const { confirm } = useConfirm()

const loading = ref(false)
const playing = ref(false)
let audio: HTMLAudioElement | null = null
let source: string | null = null

async function play() {
  if (audio && playing.value) {
    audio.pause()
    playing.value = false
    return
  }

  loading.value = true
  try {
    if (!audio) {
      const blob = await loadVoice(props.meal.id)
      source = URL.createObjectURL(blob)
      audio = new Audio(source)
      audio.onended = () => {
        playing.value = false
      }
      audio.onpause = () => {
        playing.value = false
      }
    }
    await audio.play()
    playing.value = true
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function forget() {
  const sure = await confirm({
    title: 'Throw the recording away?',
    description: 'The words stay on the meal. The audio cannot be got back.',
    confirmLabel: 'Throw it away',
    color: 'error'
  })
  if (!sure) {
    return
  }
  try {
    emit('changed', await dropVoice(props.meal.id))
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  }
}

onBeforeUnmount(() => {
  audio?.pause()
  if (source) {
    URL.revokeObjectURL(source)
  }
})
</script>

<template>
  <span class="flex items-center gap-1">
    <button
      type="button"
      class="app-press inline-flex h-7 items-center gap-1.5 rounded-full bg-default px-2.5 text-xs font-semibold text-default tabular-nums ring-1 ring-default outline-none focus-visible:ring-2 focus-visible:ring-primary"
      :title="meal.voice_transcribed
        ? 'Listen back — the note is what the browser heard, unchecked'
        : 'Listen back — this was never written down'"
      :aria-label="playing ? 'Pause the recording' : 'Play the recording'"
      @click="play"
    >
      <UIcon
        :name="loading
          ? 'i-lucide-loader-circle'
          : playing ? 'i-lucide-pause' : 'i-lucide-play'"
        :class="['size-3.5 text-primary', loading && 'animate-spin']"
      />
      {{ meal.voice_seconds ? clockOf(meal.voice_seconds) : 'Play' }}
    </button>

    <UButton
      icon="i-lucide-trash-2"
      size="sm"
      color="neutral"
      variant="ghost"
      square
      class="app-hit text-dimmed"
      title="Throw the recording away, keep the words"
      aria-label="Delete the recording"
      @click="forget"
    />
  </span>
</template>
