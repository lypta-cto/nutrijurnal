<script setup lang="ts">
/**
 * An empty state that invites the next step rather than apologising, as iOS's
 * "content unavailable" view sets it: a large grey glyph, a short title, one
 * sentence, and the button that does it (default slot). No badge, no
 * decoration — the button is the only colour.
 *
 *   <ShellEmpty icon="i-lucide-utensils" title="Nothing written down yet"
 *               description="Tap + to add what you ate — a search, a barcode or just the kcal.">
 *     <UButton label="Add food" icon="i-lucide-plus" @click="useQuickAdd().open()" />
 *   </ShellEmpty>
 *
 * `compact` is the in-group version: one row, left-aligned with the rows
 * around it, the button on the right.
 */
withDefaults(defineProps<{
  title: string
  description?: string
  icon?: string
  compact?: boolean
}>(), {
  description: undefined,
  icon: 'i-lucide-inbox',
  compact: false
})

defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <div
    v-if="compact"
    class="flex min-h-11 min-w-0 items-center gap-3 px-4 py-2.5"
  >
    <span class="flex w-6 shrink-0 items-center justify-center text-muted">
      <UIcon
        :name="icon"
        class="size-5.5"
      />
    </span>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-body text-default">{{ title }}</span>
      <span
        v-if="description"
        class="text-footnote text-muted"
      >{{ description }}</span>
    </span>
    <span
      v-if="$slots.default"
      class="flex shrink-0 items-center gap-2"
    >
      <slot />
    </span>
  </div>

  <div
    v-else
    class="flex flex-col items-center gap-2 px-6 py-10 text-center"
  >
    <UIcon
      :name="icon"
      class="mb-2 size-11 text-dimmed"
    />

    <h3 class="text-title3 text-highlighted">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="max-w-72 text-subheadline text-pretty text-muted"
    >
      {{ description }}
    </p>

    <div
      v-if="$slots.default"
      class="mt-3 flex flex-wrap items-center justify-center gap-2"
    >
      <slot />
    </div>
  </div>
</template>
