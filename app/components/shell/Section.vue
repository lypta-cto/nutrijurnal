<script setup lang="ts">
/**
 * A titled group of cards on a screen — "This week", "Your recipes": a heading
 * line (title, a muted note under it, an action on the right) and the cards
 * stacked beneath. Sections sit `gap-6` apart; cards inside them `gap-3`.
 *
 *   <ShellSection title="This week" description="Against 2 300 kcal a day">
 *     <template #actions><UButton label="See all" variant="link" … /></template>
 *     <ShellCard>…</ShellCard>
 *   </ShellSection>
 */
defineProps<{
  title?: string
  description?: string
}>()

defineSlots<{
  default?: () => unknown
  /** A link or a small button on the right of the heading */
  actions?: () => unknown
}>()
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3">
    <header
      v-if="title || $slots.actions"
      class="flex items-end gap-3 px-1"
    >
      <div class="min-w-0 flex-1">
        <h2
          v-if="title"
          class="truncate text-headline font-semibold text-highlighted"
        >
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="truncate text-xs text-muted"
        >
          {{ description }}
        </p>
      </div>

      <div
        v-if="$slots.actions"
        class="flex shrink-0 items-center gap-1"
      >
        <slot name="actions" />
      </div>
    </header>

    <slot />
  </section>
</template>
