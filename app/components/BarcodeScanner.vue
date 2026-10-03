<script setup lang="ts">
import type { ScanResult } from '~/composables/useEating'
import type { ScannedCode } from '~/composables/useBarcodeScanner'

/**
 * The camera, reading barcodes as they come into view. A hit buzzes, closes
 * the camera and is looked up (own foods, then Open Food Facts); what comes
 * back is handed to the page. When the camera cannot be used — no HTTPS, a
 * refused permission, no camera at all — it says why, and the digits can be
 * typed or a photo taken instead.
 */
const emit = defineEmits<{ result: [ScanResult] }>()

const { lookupBarcode, scanFood } = useEating()
const toast = useToast()

const video = ref<HTMLVideoElement | null>(null)
const { state, engine, torchSupported, torchOn, start, stop, toggleTorch } = useBarcodeScanner(video)

const looking = ref<string | null>(null)
const typed = ref('')
const photoInput = ref<HTMLInputElement | null>(null)

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

async function lookUp(code: string) {
  looking.value = code
  try {
    emit('result', await lookupBarcode(code))
  } catch (error) {
    fail(error)
    void begin()
  } finally {
    looking.value = null
  }
}

function onCode(hit: ScannedCode) {
  void lookUp(hit.code)
}

async function begin() {
  await start(onCode)
}

onMounted(() => void begin())

function submitTyped() {
  const code = typed.value.replace(/\D/g, '')
  if (code.length < 6 || code.length > 14) {
    toast.add({ title: 'A barcode has 8 to 13 digits', icon: 'i-lucide-circle-help', color: 'warning' })
    return
  }
  stop()
  void lookUp(code)
}

async function onPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  stop()
  looking.value = 'photo'
  try {
    emit('result', await scanFood(file))
  } catch (error) {
    fail(error)
  } finally {
    looking.value = null
  }
}

/** What to say under the picture, for every state the camera can be in */
const notice = computed<{ title: string, description: string, icon: string, color: 'neutral' | 'warning' | 'error' } | null>(() => {
  switch (state.value) {
    case 'denied':
      return {
        title: 'Camera access is blocked',
        description: 'Allow the camera for this site in your browser\'s settings and try again — or take a photo of the barcode instead.',
        icon: 'i-lucide-camera-off',
        color: 'warning'
      }
    case 'insecure':
      return {
        title: 'The camera needs a secure connection',
        description: 'Browsers only open the camera on HTTPS. Take a photo of the barcode instead.',
        icon: 'i-lucide-lock',
        color: 'warning'
      }
    case 'unavailable':
      return {
        title: 'No camera found',
        description: 'Type the digits under the bars, or upload a photo of them.',
        icon: 'i-lucide-camera-off',
        color: 'neutral'
      }
    case 'failed':
      return {
        title: 'The camera did not start',
        description: 'Try again, or take a photo of the barcode instead.',
        icon: 'i-lucide-circle-alert',
        color: 'error'
      }
    default:
      return null
  }
})

const live = computed(() => state.value === 'scanning' || state.value === 'starting')
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- The picture, with the guide the bars should fill -->
    <div
      v-show="live || looking"
      class="relative aspect-[4/3] w-full overflow-hidden rounded-card bg-black"
    >
      <video
        ref="video"
        class="size-full object-cover"
        autoplay
        muted
        playsinline
        aria-label="Camera"
      />

      <div
        class="pointer-events-none absolute inset-x-[8%] top-1/2 h-[45%] -translate-y-1/2 rounded-tile border-2 border-white/85 shadow-[0_0_0_9999px_rgb(0_0_0/0.4)]"
        aria-hidden="true"
      >
        <span
          v-if="state === 'scanning'"
          class="scan-line absolute inset-x-3 top-1/2 h-0.5 rounded-full bg-primary"
        />
      </div>

      <div
        v-if="state === 'starting' || looking"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-sm font-semibold text-white backdrop-blur-[2px]"
        role="status"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin"
        />
        <template v-if="looking === 'photo'">
          Reading the photo…
        </template>
        <template v-else-if="looking">
          Looking up {{ looking }}…
        </template>
        <template v-else>
          Opening the camera…
        </template>
      </div>

      <UButton
        v-if="torchSupported && state === 'scanning'"
        :icon="torchOn ? 'i-lucide-flashlight-off' : 'i-lucide-flashlight'"
        color="neutral"
        variant="ghost"
        square
        class="absolute top-3 right-3 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 active:bg-black/70"
        :aria-label="torchOn ? 'Turn the light off' : 'Turn the light on'"
        :aria-pressed="torchOn"
        @click="toggleTorch"
      />
    </div>

    <p
      v-if="state === 'scanning'"
      class="text-center text-sm text-muted"
      role="status"
    >
      Hold the barcode inside the frame — it is read by itself.
      <span
        v-if="engine === 'wasm'"
        class="text-dimmed"
      >Hold still a moment if it is slow.</span>
    </p>

    <UAlert
      v-if="notice"
      :title="notice.title"
      :description="notice.description"
      :icon="notice.icon"
      :color="notice.color"
      variant="subtle"
    />

    <UButton
      v-if="state === 'idle' && !looking"
      label="Scan again"
      icon="i-lucide-scan-barcode"
      color="neutral"
      variant="soft"
      size="lg"
      block
      @click="begin"
    />
    <UButton
      v-else-if="state === 'denied' || state === 'failed'"
      label="Try the camera again"
      icon="i-lucide-rotate-ccw"
      color="neutral"
      variant="soft"
      size="lg"
      block
      @click="begin"
    />

    <!-- Every other way to the same digits -->
    <form
      class="flex items-center gap-2"
      @submit.prevent="submitTyped"
    >
      <UInput
        v-model="typed"
        inputmode="numeric"
        autocomplete="off"
        placeholder="Or type the digits under the bars"
        class="min-w-0 flex-1"
        :ui="{ base: 'tabular-nums' }"
        aria-label="Barcode digits"
      />
      <UButton
        type="submit"
        label="Look up"
        color="neutral"
        variant="soft"
        :disabled="typed.replace(/\D/g, '').length < 6 || Boolean(looking)"
      />
    </form>

    <input
      ref="photoInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="onPhoto"
    >
    <UButton
      label="Take a photo instead"
      icon="i-lucide-camera"
      color="neutral"
      variant="ghost"
      class="self-center"
      :disabled="Boolean(looking)"
      @click="photoInput?.click()"
    />
  </div>
</template>

<style scoped>
/* The line sweeping the guide — a still line under reduced motion */
.scan-line {
  animation: scan-sweep 1.6s ease-in-out infinite alternate;
  box-shadow: 0 0 12px var(--ui-primary);
}

@keyframes scan-sweep {
  from {
    transform: translateY(-2.2rem);
  }

  to {
    transform: translateY(2.2rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scan-line {
    animation: none;
  }
}
</style>
