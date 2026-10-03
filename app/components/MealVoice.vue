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
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
    loading.value = false
    return
  }
  try {
    await audio.play()
    playing.value = true
  } catch (error) {
    // iOS only lets a tap start sound, and the wait for the download used the
    // tap up; the audio is ready now, so the next tap plays it at once
    if ((error as { name?: string })?.name === 'NotAllowedError') {
      toast.add({ title: 'Ready — tap play again to listen', icon: 'i-lucide-play', color: 'neutral' })
    } else {
      // Fetched fine but the device can't decode it — a WebM said on Android
      // and opened on an older iPhone. Not a connection problem.
      toast.add({
        title: 'This recording can’t be played on this device',
        description: 'It was made on another phone or browser. Try opening the diary there.',
        icon: 'i-lucide-volume-x',
        color: 'warning'
      })
    }
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
