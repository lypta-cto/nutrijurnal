<script setup lang="ts">
/**
 * Placeholders shaped like what is coming — list rows, a card, the rings, a
 * row of tiles, lines of text — with a slow sweep of light, so the screen
 * keeps its layout while it loads and nothing jumps when the data lands.
 *
 *   <ShellSkeleton variant="ring" />
 *   <ShellCard flush title="Breakfast"><ShellSkeleton variant="rows" :count="2" /></ShellCard>
 */
withDefaults(defineProps<{
  variant?: 'rows' | 'card' | 'ring' | 'tiles' | 'text'
  /** How many rows, tiles or lines */
  count?: number
}>(), {
  variant: 'rows',
  count: 3
})
</script>

<template>
  <div
    role="status"
    aria-label="Loading"
    aria-busy="true"
  >
    <div
      v-if="variant === 'rows'"
      class="divide-y divide-default"
    >
      <div
        v-for="row in count"
        :key="row"
        class="flex items-center gap-3 px-4 py-3"
      >
        <span class="app-shimmer size-10 shrink-0 rounded-xl" />
        <span class="flex flex-1 flex-col gap-2">
          <span
            class="app-shimmer h-3.5 rounded-full"
            :class="row % 2 ? 'w-3/5' : 'w-2/5'"
          />
          <span class="app-shimmer h-2.5 w-1/3 rounded-full" />
        </span>
        <span class="app-shimmer h-3.5 w-10 shrink-0 rounded-full" />
      </div>
    </div>

    <div
      v-else-if="variant === 'card'"
      class="app-card flex flex-col gap-3 p-4"
    >
      <span class="app-shimmer h-4 w-1/3 rounded-full" />
      <span
        v-for="line in count"
        :key="line"
        class="app-shimmer h-3 rounded-full"
        :class="line === count ? 'w-1/2' : 'w-full'"
      />
    </div>

    <div
      v-else-if="variant === 'ring'"
      class="flex justify-center py-2"
    >
      <!-- A disc with its middle cut out, the shape of the rings -->
      <span class="app-shimmer size-44 rounded-full [mask:radial-gradient(circle,transparent_56%,#000_57%)]" />
    </div>

    <div
      v-else-if="variant === 'tiles'"
      class="grid gap-3"
      :style="{ gridTemplateColumns: `repeat(${Math.min(count, 3)}, minmax(0, 1fr))` }"
    >
      <span
        v-for="tile in count"
        :key="tile"
        class="app-shimmer h-22 rounded-tile"
      />
    </div>

    <div
      v-else
      class="flex flex-col gap-2.5"
    >
      <span
        v-for="line in count"
        :key="line"
        class="app-shimmer h-3 rounded-full"
        :class="line === count ? 'w-2/3' : 'w-full'"
      />
    </div>
  </div>
</template>
