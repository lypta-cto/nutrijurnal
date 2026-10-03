<script setup lang="ts">
/**
 * A card that reads like a sheet: a one-line header (title · count · hint ·
 * actions), then rows the page renders on one shared grid template — so every
 * value sits in its column down the whole list.
 */
defineProps<{
  title: string
  icon?: string
  /** Shown as a small pill next to the title */
  count?: number | string | null
  /** Quiet words after the count */
  hint?: string
  loading?: boolean
  /** Rendered instead of rows when there is nothing */
  empty?: string
  isEmpty?: boolean
}>()

defineSlots<{
  default?: () => unknown
  actions?: () => unknown
}>()
</script>

<template>
  <section class="app-card flex min-h-0 flex-col overflow-hidden">
    <header class="flex items-center gap-2 px-4 py-2.5">
      <UIcon
        v-if="icon"
        :name="icon"
        class="size-4 shrink-0 text-muted"
      />
      <h2 class="text-sm font-semibold text-highlighted">
        {{ title }}
      </h2>
      <span
        v-if="count !== undefined && count !== null"
        class="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold tabular-nums text-default"
      >{{ count }}</span>
      <span
        v-if="hint"
        class="truncate text-xs text-muted"
      >{{ hint }}</span>
      <span
        v-if="$slots.actions"
        class="ml-auto flex items-center gap-1"
      >
        <slot name="actions" />
      </span>
    </header>

    <div
      v-if="loading && isEmpty"
      class="border-t border-default px-4 py-3"
    >
      <USkeleton class="h-4 w-2/3" />
    </div>
    <p
      v-else-if="isEmpty"
      class="border-t border-default px-4 py-3 text-sm text-muted"
    >
      {{ empty ?? 'Nothing here.' }}
    </p>
    <div
      v-else
      class="min-h-0 flex-1 divide-y divide-default border-t border-default"
    >
      <slot />
    </div>
  </section>
</template>
