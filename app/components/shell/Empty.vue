<script setup lang="ts">
/**
 * An empty state that invites the next step rather than apologising: a soft
 * badge with an icon (three small dots in the macro colours around it), a
 * short title, one sentence, and the button that does it (default slot).
 *
 *   <ShellEmpty icon="i-lucide-utensils" title="Nothing written down yet"
 *               description="Tap + to add what you ate — a search, a barcode or just the kcal.">
 *     <UButton label="Add food" icon="i-lucide-plus" @click="useQuickAdd().open()" />
 *   </ShellEmpty>
 *
 * `compact` is the in-card version: one row, left-aligned with the rows around
 * it, the button on the right.
 */
withDefaults(defineProps<{
  title: string
  description?: string
  icon?: string
  compact?: boolean
}>(), {
  description: undefined,
  icon: 'i-lucide-leaf',
  compact: false
})

defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <div
    v-if="compact"
    class="flex min-w-0 items-center gap-3 px-4 py-3.5"
  >
    <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <UIcon
        :name="icon"
        class="size-5"
      />
    </span>
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-sm font-semibold text-highlighted">{{ title }}</span>
      <span
        v-if="description"
        class="text-xs text-muted"
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
    class="flex flex-col items-center gap-3 px-6 py-10 text-center"
  >
    <span class="relative mb-1 flex size-18 items-center justify-center rounded-full bg-primary/10 text-primary">
      <UIcon
        :name="icon"
        class="size-8"
      />
      <span
        class="absolute -top-0.5 right-1 size-2.5 rounded-full bg-protein"
        aria-hidden="true"
      />
      <span
        class="absolute bottom-1 -left-1.5 size-2 rounded-full bg-carbs"
        aria-hidden="true"
      />
      <span
        class="absolute -right-2 bottom-3 size-1.5 rounded-full bg-fat"
        aria-hidden="true"
      />
    </span>

    <h3 class="font-display text-xl font-semibold text-highlighted">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="max-w-72 text-sm text-muted"
    >
      {{ description }}
    </p>

    <div
      v-if="$slots.default"
      class="mt-2 flex flex-wrap items-center justify-center gap-2"
    >
      <slot />
    </div>
  </div>
</template>
