<script setup lang="ts">
/**
 * The top app bar: a small eyebrow line (today's date unless told otherwise),
 * the screen's title in the display face, and its actions on the right — with
 * an optional second row (a week strip, tabs, a search field) pinned with it.
 *
 * Transparent at rest, so the morning light at the top of the screen shows
 * through; once the page scrolls under it, it turns to glass with a hairline,
 * and the content reads as passing beneath it.
 *
 *   <ShellAppBar title="Library" />
 *   <ShellAppBar title="Today" eyebrow="">
 *     <template #heading>…the day picker…</template>
 *     <template #actions><UButton … /></template>
 *     <template #toolbar>…the week strip…</template>
 *   </ShellAppBar>
 *
 * It doesn't set the document title — AppPage does that for the screen.
 */
const props = withDefaults(defineProps<{
  title: string
  /** The line above the title; today's date when left out, an empty string for none */
  eyebrow?: string | null
  /** A back arrow before the title: `true` goes back in history, a path goes there */
  back?: boolean | string
}>(), {
  eyebrow: undefined,
  back: false
})

defineSlots<{
  /** Replaces the eyebrow and title — Today puts its day picker here */
  heading?: () => unknown
  /** Icon buttons on the right */
  actions?: () => unknown
  /** A second row that stays pinned with the bar */
  toolbar?: () => unknown
}>()

const router = useRouter()

const eyebrowText = computed(() => {
  if (props.eyebrow === null || props.eyebrow === '') {
    return null
  }
  return props.eyebrow ?? new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
})

function goBack() {
  if (typeof props.back === 'string') {
    void router.push(props.back)
  } else if (window.history.length > 1) {
    router.back()
  } else {
    // Opened straight onto this screen: there is no history to go back to
    void router.push('/')
  }
}

// Read once per frame at most — scroll fires far more often than it paints
const scrolled = ref(false)
let frame = 0

function measure() {
  frame = 0
  scrolled.value = window.scrollY > 4
}

function onScroll() {
  if (!frame) {
    frame = requestAnimationFrame(measure)
  }
}

onMounted(() => {
  measure()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (frame) {
    cancelAnimationFrame(frame)
  }
})
</script>

<template>
  <header
    class="app-safe-top sticky top-0 z-30 transition-[background-color,box-shadow] duration-200 ease-soft"
    :class="scrolled ? 'app-glass-canvas shadow-[0_1px_0_var(--ui-border)]' : 'bg-transparent'"
  >
    <div class="flex min-h-16 items-center gap-2 px-4 pt-2 pb-1.5">
      <UButton
        v-if="back"
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        square
        class="-ml-2.5"
        aria-label="Go back"
        @click="goBack"
      />

      <div class="min-w-0 flex-1">
        <slot name="heading">
          <p
            v-if="eyebrowText"
            class="app-eyebrow truncate"
          >
            {{ eyebrowText }}
          </p>
          <h1 class="truncate font-display text-title font-semibold text-highlighted">
            {{ title }}
          </h1>
        </slot>
      </div>

      <div
        v-if="$slots.actions"
        class="flex shrink-0 items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </div>

    <div
      v-if="$slots.toolbar"
      class="px-4 pt-1 pb-3"
    >
      <slot name="toolbar" />
    </div>
  </header>
</template>
