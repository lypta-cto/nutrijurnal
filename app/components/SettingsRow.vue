<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-3 border-b border-default py-4 last:border-0">
    <div class="min-w-0">
      <p class="text-sm font-medium text-highlighted">
        {{ title }}
      </p>
      <p
        v-if="description"
        class="mt-0.5 text-sm text-muted"
      >
        {{ description }}
      </p>
    </div>

    <div class="flex">
      <slot />
    </div>
  </div>
</template>
