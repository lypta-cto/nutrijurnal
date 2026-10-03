<script setup lang="ts">
/**
 * One screen of the phone shell: a header that stays put at the top (under
 * the notch, never behind it) and the page body scrolling under it.
 */
const props = withDefaults(defineProps<{
  /** Names the browser tab, and heads the page unless `heading` replaces it */
  title: string
  description?: string
  /** A back arrow before the title, for screens one level down */
  back?: boolean
}>(), {
  back: false
})

defineSlots<{
  /** Replaces the plain title — the diary puts its day picker here */
  heading?: () => unknown
  /** Icon buttons on the right of the header */
  actions?: () => unknown
  /** A second header row that stays pinned with it — a week strip, tabs */
  toolbar?: () => unknown
  /** Page body */
  default?: () => unknown
}>()

useHead({ title: props.title })
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header class="app-safe-top app-canvas sticky top-0 z-30">
      <div class="flex min-h-14 items-center gap-2 px-4 pt-2">
        <UButton
          v-if="back"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          square
          aria-label="Go back"
          @click="$router.back()"
        />

        <div class="min-w-0 flex-1">
          <slot name="heading">
            <h1 class="truncate text-xl font-semibold text-highlighted">
              {{ title }}
            </h1>
            <p
              v-if="description"
              class="truncate text-xs text-muted"
            >
              {{ description }}
            </p>
          </slot>
        </div>

        <div
          v-if="$slots.actions"
          class="flex shrink-0 items-center gap-1.5"
        >
          <slot name="actions" />
        </div>
      </div>

      <div
        v-if="$slots.toolbar"
        class="px-4 pt-2 pb-1"
      >
        <slot name="toolbar" />
      </div>
    </header>

    <main
      :key="$route.path"
      class="app-page-in flex flex-col gap-4 px-4 pt-3 pb-6"
    >
      <slot />
    </main>
  </div>
</template>
