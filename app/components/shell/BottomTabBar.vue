<script setup lang="ts">
/**
 * The app's navigation: four places and, in the middle, the one action the
 * whole app exists for — writing down what was eaten.
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
  { label: 'Library', icon: 'i-lucide-book-open', to: '/library' }
]

const RIGHT: Tab[] = [
  { label: 'Progress', icon: 'i-lucide-chart-line', to: '/progress' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }
]

function isActive(tab: Tab): boolean {
  return tab.to === '/' ? route.path === '/' : route.path.startsWith(tab.to)
}
</script>

<template>
  <nav
    class="app-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-default bg-default/90 backdrop-blur"
    aria-label="Main"
  >
    <div class="mx-auto grid h-16 w-full max-w-[34rem] grid-cols-5 items-center px-2">
      <NuxtLink
        v-for="tab in LEFT"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors"
        :class="isActive(tab) ? 'text-primary' : 'text-muted hover:text-default'"
        :aria-current="isActive(tab) ? 'page' : undefined"
      >
        <UIcon
          :name="tab.icon"
          class="size-5"
        />
        {{ tab.label }}
      </NuxtLink>

      <div class="flex justify-center">
        <UButton
          icon="i-lucide-plus"
          size="xl"
          class="size-12 justify-center rounded-full shadow-lg"
          aria-label="Add food"
          @click="quickAdd.open()"
        />
      </div>

      <NuxtLink
        v-for="tab in RIGHT"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors"
        :class="isActive(tab) ? 'text-primary' : 'text-muted hover:text-default'"
        :aria-current="isActive(tab) ? 'page' : undefined"
      >
        <UIcon
          :name="tab.icon"
          class="size-5"
        />
        {{ tab.label }}
      </NuxtLink>
    </div>
  </nav>
</template>
