<script setup lang="ts">
const { app } = useAppConfig()
</script>

<template>
  <NuxtLink
    to="/"
    class="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
    :aria-label="app.name"
  >
    <AppLogoMark class="size-7 shrink-0 text-primary" />

    <span class="truncate font-semibold text-highlighted">
      {{ app.name }}
    </span>
  </NuxtLink>
</template>
