<script setup lang="ts">
/**
 * One screen of the phone shell: the app bar (ShellAppBar — transparent at
 * rest, glass once the page scrolls under it) and the page body under it,
 * its cards cascading in on arrival.
 *
 *   <AppPage title="Library" eyebrow="Your foods and recipes">
 *     <template #actions>…</template>
 *     <template #toolbar>…a segmented control, a search field…</template>
 *     <ShellCard>…</ShellCard>
 *   </AppPage>
 */
const props = withDefaults(defineProps<{
  /** Names the browser tab, and heads the page unless `heading` replaces it */
  title: string
  /** The small line over the title; today's date when left out, '' for none */
  eyebrow?: string | null
  /** A back arrow before the title, for screens one level down */
  back?: boolean | string
}>(), {
  eyebrow: undefined,
  back: false
})

defineSlots<{
  /** Replaces the eyebrow and title — the diary puts its day picker here */
  heading?: () => unknown
  /** Buttons on the right of the bar */
  actions?: () => unknown
  /** A second row that stays pinned with the bar — tabs, a search field */
  toolbar?: () => unknown
  /** Page body */
  default?: () => unknown
}>()

useHead({ title: props.title })
</script>

<template>
  <div class="flex flex-1 flex-col">
    <ShellAppBar
      :title="title"
      :eyebrow="eyebrow"
      :back="back"
    >
      <template
        v-if="$slots.heading"
        #heading
      >
        <slot name="heading" />
      </template>
      <template
        v-if="$slots.actions"
        #actions
      >
        <slot name="actions" />
      </template>
      <template
        v-if="$slots.toolbar"
        #toolbar
      >
        <slot name="toolbar" />
      </template>
    </ShellAppBar>

    <main
      :key="$route.path"
      class="app-page-in flex flex-col gap-3 px-4 pt-2 pb-6"
    >
      <slot />
    </main>
  </div>
</template>
