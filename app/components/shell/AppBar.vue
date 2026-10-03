<script setup lang="ts">
/**
 * iOS's large-title navigation bar. A 44 px bar holds the back chevron and the
 * actions; the screen's title sits under it in Large Title type and scrolls
 * away with the page. Once it has gone under the bar, the bar turns to glass
 * and shows the title small and centred — the compact bar. A #toolbar (a
 * segmented control, a search field) sticks under the bar from then on.
 *
 * With nothing in the bar (no back, no actions) the large title tucks up under
 * it, so a screen doesn't open on an empty strip.
 *
 *   <ShellAppBar title="Library" />
 *   <ShellAppBar title="Today" eyebrow="" compact-title="Yesterday">
 *     <template #heading>…the day picker…</template>
 *     <template #actions><UButton … /></template>
 *     <template #toolbar>…</template>
 *   </ShellAppBar>
 *
 * It doesn't set the document title — AppPage does that for the screen.
 */
const props = withDefaults(defineProps<{
  title: string
  /** The line above the title; today's date when left out, an empty string for none */
  eyebrow?: string | null
  /** A back chevron in the bar: `true` goes back in history, a path goes there */
  back?: boolean | string
  /** The compact bar's title, when #heading shows something other than `title` */
  compactTitle?: string
}>(), {
  eyebrow: undefined,
  back: false,
  compactTitle: undefined
})

const slots = defineSlots<{
  /** Replaces the eyebrow and the large title — Today puts its day picker here */
  heading?: () => unknown
  /** Buttons on the right of the bar */
  actions?: () => unknown
  /** A row that sticks under the bar once the large title has scrolled away */
  toolbar?: () => unknown
}>()

const router = useRouter()

const eyebrowText = computed(() => {
  if (props.eyebrow === null || props.eyebrow === '') {
    return null
  }
  return props.eyebrow ?? new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
})

/** Something to show in the bar at rest; without it the title tucks under the empty bar */
const barItems = computed(() => Boolean(props.back || slots.actions))

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

const bar = useTemplateRef<HTMLElement>('bar')
const heading = useTemplateRef<HTMLElement>('heading')

/** Content has started to pass under the bar: glass */
const scrolled = ref(false)
/** The large title is gone under the bar: the compact title shows, the toolbar sticks */
const collapsed = ref(false)

// Read once per frame at most — scroll fires far more often than it paints
let frame = 0

function measure() {
  frame = 0
  scrolled.value = window.scrollY > 0
  if (bar.value && heading.value) {
    // A few pixels' grace, so the small title arrives as the big one's last line leaves
    collapsed.value = heading.value.getBoundingClientRect().bottom - 6 <= bar.value.getBoundingClientRect().bottom
  }
}

function onScroll() {
  if (!frame) {
    frame = requestAnimationFrame(measure)
  }
}

onMounted(() => {
  measure()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (frame) {
    cancelAnimationFrame(frame)
  }
})
</script>

<template>
  <!-- `contents`: the bar and the toolbar stick against the page, not this wrapper -->
  <div class="contents">
    <header
      ref="bar"
      class="app-safe-top sticky top-0 z-30"
      :class="barItems || collapsed ? '' : 'pointer-events-none'"
    >
      <!-- The material fades in rather than snapping on. Under the status bar
           it comes as soon as anything scrolls; the bar itself turns once
           content passes under its items — or, when it has none, once the
           large title tucked under it has gone -->
      <div
        class="app-glass absolute inset-x-0 top-0 h-[env(safe-area-inset-top)] transition-opacity duration-200 ease-soft motion-reduce:transition-none"
        :class="scrolled ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />
      <div
        class="app-glass absolute inset-x-0 bottom-0 h-(--app-bar-height) transition-opacity duration-200 ease-soft motion-reduce:transition-none"
        :class="(barItems ? scrolled : collapsed) ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />
      <div
        class="absolute inset-x-0 bottom-0 h-(--app-hairline) bg-separator transition-opacity duration-200 ease-soft motion-reduce:transition-none"
        :class="collapsed && !$slots.toolbar ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />

      <div class="relative flex h-(--app-bar-height) items-center gap-1 px-2">
        <UButton
          v-if="back"
          icon="i-lucide-chevron-left"
          variant="ghost"
          square
          aria-label="Go back"
          class="pointer-events-auto"
          :ui="{ leadingIcon: 'size-6' }"
          @click="goBack"
        />

        <!-- Centred on the screen, whatever sits either side of it. The large
             title is still the page's heading for a screen reader -->
        <p
          class="pointer-events-none absolute inset-x-24 truncate text-center text-headline text-highlighted transition-[opacity,translate] duration-200 ease-soft motion-reduce:transition-none"
          :class="collapsed ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'"
          aria-hidden="true"
        >
          {{ compactTitle ?? title }}
        </p>

        <div
          v-if="$slots.actions"
          class="pointer-events-auto ml-auto flex shrink-0 items-center gap-1"
        >
          <slot name="actions" />
        </div>
      </div>
    </header>

    <div
      ref="heading"
      class="relative min-w-0 px-4 pb-2"
      :class="barItems ? 'pt-0.5' : '-mt-(--app-bar-height) pt-3'"
    >
      <slot name="heading">
        <p
          v-if="eyebrowText"
          class="app-eyebrow truncate"
        >
          {{ eyebrowText }}
        </p>
        <h1 class="truncate text-large-title text-highlighted">
          {{ title }}
        </h1>
      </slot>
    </div>

    <div
      v-if="$slots.toolbar"
      class="sticky z-30 top-[calc(env(safe-area-inset-top)+var(--app-bar-height))] px-4 pt-1 pb-2.5"
    >
      <div
        class="app-glass absolute inset-0 transition-opacity duration-200 ease-soft motion-reduce:transition-none"
        :class="collapsed ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />
      <div
        class="absolute inset-x-0 bottom-0 h-(--app-hairline) bg-separator transition-opacity duration-200 ease-soft motion-reduce:transition-none"
        :class="collapsed ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />
      <div class="relative">
        <slot name="toolbar" />
      </div>
    </div>
  </div>
</template>
