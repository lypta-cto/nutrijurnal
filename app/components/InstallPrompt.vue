<script setup lang="ts">
import { isIos, isStandalone } from '~/composables/usePush'

/**
 * "Put Nutrijurnal on your home screen" — offered once the browser says it
 * can be installed (Android and desktop Chromium raise
 * `beforeinstallprompt`, which @vite-pwa/nuxt holds back for us), or, on an
 * iPhone in Safari, as the two steps Safari needs because it has no prompt
 * of its own. On Today it can be snoozed for two weeks; in Settings it is
 * always there until the app is installed.
 */
const props = withDefaults(defineProps<{
  /** `card` sits on Today and can be snoozed; `settings` stays until installed */
  variant?: 'card' | 'settings'
}>(), {
  variant: 'card'
})

const { $pwa } = useNuxtApp()

const SNOOZE_KEY = 'nutrijurnal-install-snoozed-until'
const SNOOZE_DAYS = 14

const snoozed = ref(false)
const ios = ref(false)
const installed = ref(false)

onMounted(() => {
  ios.value = isIos() && !isStandalone()
  installed.value = isStandalone() || Boolean($pwa?.isPWAInstalled)
  try {
    snoozed.value = Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now()
  } catch {
    snoozed.value = false
  }
})

const canPrompt = computed(() => Boolean($pwa?.showInstallPrompt) && !installed.value)

const visible = computed(() => {
  if (installed.value || (props.variant === 'card' && snoozed.value)) {
    return false
  }
  return canPrompt.value || ios.value
})

async function install() {
  const choice = await $pwa?.install()
  if (choice?.outcome === 'accepted') {
    installed.value = true
  }
}

function snooze() {
  snoozed.value = true
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000))
  } catch {
    // Not remembered on this browser; it simply asks again next time
  }
}
</script>

<template>
  <section
    v-if="visible"
    class="app-card flex flex-col gap-3 px-4 py-3"
    aria-label="Install the app"
  >
    <div class="flex items-start gap-3">
      <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UIcon
          name="i-lucide-smartphone"
          class="size-5"
        />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-highlighted">
          Put Nutrijurnal on your home screen
        </p>
        <p class="text-xs text-muted">
          It opens like an app, works offline for reading, and can send you reminders.
        </p>
      </div>
    </div>

    <!-- Safari has no install prompt: say where its two taps are -->
    <ol
      v-if="ios && !canPrompt"
      class="flex flex-col gap-1.5 rounded-xl bg-elevated/60 px-3 py-2 text-xs text-default"
    >
      <li class="flex items-center gap-2">
        <span class="flex size-5 items-center justify-center rounded-full bg-default text-[10px] font-semibold text-muted">1</span>
        Tap
        <UIcon
          name="i-lucide-share"
          class="size-4 text-primary"
          aria-label="the Share button"
        />
        in Safari's toolbar
      </li>
      <li class="flex items-center gap-2">
        <span class="flex size-5 items-center justify-center rounded-full bg-default text-[10px] font-semibold text-muted">2</span>
        Choose
        <span class="inline-flex items-center gap-1 font-medium">
          <UIcon
            name="i-lucide-square-plus"
            class="size-4"
          />
          Add to Home Screen
        </span>
      </li>
    </ol>

    <div
      v-if="canPrompt || variant === 'card'"
      class="flex gap-2"
    >
      <UButton
        v-if="canPrompt"
        label="Install"
        icon="i-lucide-download"
        class="flex-1 justify-center"
        @click="install"
      />
      <UButton
        v-if="variant === 'card'"
        :label="canPrompt ? 'Not now' : 'Got it'"
        color="neutral"
        variant="ghost"
        :class="!canPrompt && 'flex-1 justify-center'"
        @click="snooze"
      />
    </div>
  </section>
</template>
