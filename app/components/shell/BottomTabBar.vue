<script setup lang="ts">
/**
 * The app's navigation: four places and, in the middle, the one action the
 * whole app exists for — writing down what was eaten. The "+" only opens the
 * quick-add sheet through useQuickAdd(); everything about adding lives there.
 *
 * A glass capsule floating over the content, clear of the home indicator: the
 * selected tab in the accent with a faint capsule behind it, the "+" a flat
 * accent circle in line with the tabs. While a text field has focus on a touch
 * screen the bar slides away, so it never rides up on the keyboard or covers
 * the field being typed into.
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
    class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-(--app-tabbar-offset) transition-[translate,opacity] duration-300 ease-soft motion-reduce:transition-none"
    :class="typing ? 'translate-y-[calc(100%+1rem)] opacity-0' : ''"
    aria-label="Main"
  >
    <div class="app-glass pointer-events-auto mx-auto grid h-(--app-tabbar-height) w-full max-w-[calc(var(--app-column)-2rem)] grid-cols-5 rounded-full border-[length:var(--app-hairline)] border-(--app-glass-border) p-1 shadow-raised">
      <template
        v-for="(side, index) in [LEFT, RIGHT]"
        :key="index"
      >
        <!-- The "+" sits between the two halves -->
        <div
          v-if="index === 1"
          class="flex items-center justify-center"
        >
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-full bg-primary text-inverted outline-none transition-transform duration-200 ease-spring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.92] motion-reduce:transition-none motion-reduce:active:scale-100"
            aria-label="Add food"
            aria-haspopup="dialog"
            :aria-expanded="quickAdd.isOpen.value"
            @click="quickAdd.open()"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-6"
            />
          </button>
        </div>

        <NuxtLink
          v-for="tab in side"
          :key="tab.to"
          :to="tab.to"
          class="relative flex flex-col items-center justify-center gap-0.5 rounded-full text-[0.625rem]/3 font-medium tracking-[0.01em] outline-none transition-colors duration-200 ease-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset motion-reduce:transition-none"
          :class="isActive(tab) ? 'text-primary' : 'text-muted active:text-default'"
          :aria-current="isActive(tab) ? 'page' : undefined"
        >
          <!-- The selected tab's faint capsule, as iOS draws it under the glass -->
          <span
            class="absolute inset-0 rounded-full bg-elevated transition-[opacity,scale] duration-300 ease-spring motion-reduce:transition-none"
            :class="isActive(tab) ? 'scale-100 opacity-100' : 'scale-90 opacity-0'"
            aria-hidden="true"
          />
          <UIcon
            :name="tab.icon"
            class="relative size-6"
          />
          <span class="relative">{{ tab.label }}</span>
        </NuxtLink>
      </template>
    </div>
  </nav>
</template>
