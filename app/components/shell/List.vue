<script setup lang="ts">
/**
 * An inset grouped list — iOS Settings: rows on one rounded surface with
 * hairlines between them that start where the text starts, a small uppercase
 * header above and a footnote under it.
 *
 *   <ShellList title="Your data" description="Exports leave through the share sheet.">
 *     <ShellListRow icon="i-lucide-file-down" title="Export the diary" @click="…" />
 *     <ShellListRow icon="i-lucide-log-out" title="Sign out" :chevron="false" @click="…" />
 *   </ShellList>
 *
 * The rows can be ShellListRows or the page's own (a food row on its grid) —
 * every direct child gets the hairline above it. Inside a sheet the surface
 * steps one layer up by itself (`.app-sheet` in main.css). `plain` drops the
 * surface: rows edge to edge, for a list that fills a sheet.
 */
withDefaults(defineProps<{
  title?: string
  /** A footnote under the group */
  description?: string
  /** Edge to edge, no rounded surface */
  plain?: boolean
}>(), {
  title: undefined,
  description: undefined,
  plain: false
})

defineSlots<{
  /** The rows */
  default?: () => unknown
  /** A link or a small button on the right of the header */
  actions?: () => unknown
}>()
</script>

<template>
  <ShellSection
    :title="title"
    :description="description"
  >
    <template
      v-if="$slots.actions"
      #actions
    >
      <slot name="actions" />
    </template>

    <div
      class="app-divide flex min-w-0 flex-col"
      :class="plain ? '' : 'app-card overflow-hidden'"
    >
      <slot />
    </div>
  </ShellSection>
</template>
