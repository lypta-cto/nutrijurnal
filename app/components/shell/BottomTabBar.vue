<script setup lang="ts">
/**
 * The app's navigation: four places and, raised in the middle, the one action
 * the whole app exists for — writing down what was eaten. The "+" only opens
 * the quick-add sheet through useQuickAdd(); everything about adding lives there.
 *
 * A floating glass bar, clear of the home indicator. While a text field has
 * focus on a touch screen it slides away, so it never rides up on the keyboard
 * or covers the field being typed into.
 */
const route = useRoute()
const quickAdd = useQuickAdd()

interface Tab {
  label: string
  icon: string
  to: string
}

const LEFT: Tab[] = [
  { label: 'Today', icon: 'i-lucide-notebook-pen', to: '/' },
  { label: 'Library', icon: 'i-lucide-chef-hat', to: '/library' }
]

const RIGHT: Tab[] = [
  { label: 'Progress', icon: 'i-lucide-chart-no-axes-column', to: '/progress' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }
]

function isActive(tab: Tab): boolean {
  return tab.to === '/' ? route.path === '/' : route.path.startsWith(tab.to)
}

// Fields that open a picker rather than the keyboard leave the bar alone
const NO_KEYBOARD = new Set([
  'button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden',
  'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week'
])

function opensKeyboard(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false
  }
  if (element.isContentEditable || element instanceof HTMLTextAreaElement) {
    return true
  }
  return element instanceof HTMLInputElement && !NO_KEYBOARD.has(element.type)
}

const typing = ref(false)
let touchScreen: MediaQueryList | null = null

function sync() {
  typing.value = Boolean(touchScreen?.matches) && opensKeyboard(document.activeElement)
}

// Focus leaves one field before it reaches the next: wait a frame, so hopping
// between fields doesn't flash the bar up and down
function onFocusOut() {
  requestAnimationFrame(sync)
}

onMounted(() => {
  touchScreen = window.matchMedia('(pointer: coarse)')
  document.addEventListener('focusin', sync)
  document.addEventListener('focusout', onFocusOut)
})

onBeforeUnmount(() => {
  document.removeEventListener('focusin', sync)
  document.removeEventListener('focusout', onFocusOut)
})
</script>

<template>
  <nav
    class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-(--app-tabbar-offset) transition-[translate,opacity] duration-300 ease-soft"
    :class="typing ? 'translate-y-[calc(100%+1rem)] opacity-0' : ''"
    aria-label="Main"
  >
    <!-- Rows passing under the bar fade out instead of colliding with its labels -->
    <div
      class="absolute inset-x-0 bottom-0 h-(--app-tabbar-space) bg-linear-to-t from-canvas via-canvas/80 to-transparent"
      aria-hidden="true"
    />

    <div class="app-glass pointer-events-auto relative mx-auto grid h-(--app-tabbar-height) w-full max-w-[calc(var(--app-column)-1.5rem)] grid-cols-5 rounded-[1.75rem] shadow-raised ring-1 ring-default">
      <template
        v-for="(side, index) in [LEFT, RIGHT]"
        :key="index"
      >
        <!-- The "+" sits between the two halves -->
        <div
          v-if="index === 1"
          class="relative flex justify-center"
        >
          <button
            type="button"
            class="absolute -top-5 flex size-14 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-fab ring-4 ring-canvas outline-none transition-transform duration-200 ease-spring focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary active:scale-90 dark:from-primary-400 dark:to-primary-600"
            aria-label="Add food"
            aria-haspopup="dialog"
            :aria-expanded="quickAdd.isOpen.value"
            @click="quickAdd.open()"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-7"
            />
          </button>
        </div>

        <NuxtLink
          v-for="tab in side"
          :key="tab.to"
          :to="tab.to"
          class="app-press flex flex-col items-center justify-center gap-0.5 rounded-[1.5rem] text-caption outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          :class="isActive(tab) ? 'font-semibold text-highlighted' : 'font-medium text-muted'"
          :aria-current="isActive(tab) ? 'page' : undefined"
        >
          <!-- The active tab's pill grows out from the icon -->
          <span class="relative flex h-8 w-14 items-center justify-center">
            <span
              class="absolute inset-0 rounded-full bg-primary/12 transition-[scale,opacity] duration-300 ease-spring"
              :class="isActive(tab) ? 'scale-100 opacity-100' : 'scale-x-50 opacity-0'"
            />
            <UIcon
              :name="tab.icon"
              class="relative size-5.5 transition-colors duration-200"
              :class="isActive(tab) ? 'text-primary' : ''"
            />
          </span>
          {{ tab.label }}
        </NuxtLink>
      </template>
    </div>
  </nav>
</template>
