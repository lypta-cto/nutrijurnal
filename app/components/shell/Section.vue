<script setup lang="ts">
/**
 * A titled group on a screen, the way iOS sets one: a small uppercase header
 * above (an action on its right), the content — cards, a form, a chart — and a
 * footnote under it that explains what the group is for.
 *
 *   <ShellSection title="Daily targets" description="Leave one empty and the diary simply counts it.">
 *     <ShellCard>…</ShellCard>
 *   </ShellSection>
 *
 * `prominent` swaps the small header for a bold Title 2 heading, sentence
 * case — Health's "Highlights", for a screen's main sections rather than a
 * settings list. A plain list of rows is a ShellList, which is a section with
 * the rows' surface built in.
 */
withDefaults(defineProps<{
  title?: string
  /** A footnote under the content */
  description?: string
  prominent?: boolean
}>(), {
  title: undefined,
  description: undefined,
  prominent: false
})

defineSlots<{
  default?: () => unknown
  /** A link or a small button on the right of the header */
  actions?: () => unknown
}>()
</script>

<template>
  <section class="flex min-w-0 flex-col">
    <header
      v-if="title || $slots.actions"
      class="flex min-h-6 items-end gap-3"
      :class="prominent ? 'px-1 pb-2' : 'px-4 pb-1.5'"
    >
      <h2
        v-if="title"
        class="min-w-0 flex-1 truncate"
        :class="prominent ? 'text-title2 text-highlighted' : 'app-group-title'"
      >
        {{ title }}
      </h2>

      <div
        v-if="$slots.actions"
        class="ml-auto flex shrink-0 items-center gap-1"
      >
        <slot name="actions" />
      </div>
    </header>

    <div class="flex min-w-0 flex-col gap-3">
      <slot />
    </div>

    <p
      v-if="description"
      class="px-4 pt-1.5 text-footnote text-pretty text-muted"
    >
      {{ description }}
    </p>
  </section>
</template>
