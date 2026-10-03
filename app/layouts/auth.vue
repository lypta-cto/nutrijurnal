<script setup lang="ts">
const { app } = useAppConfig()
</script>

<template>
  <!-- One narrow column, like the app itself; the form sits in the middle of it -->
  <div class="app-canvas app-safe-top app-safe-bottom flex min-h-svh flex-col">
    <header class="mx-auto flex w-full max-w-[34rem] items-center justify-between gap-3 px-6 pt-6">
      <AppLogo />
      <ThemeToggle />
    </header>

    <main class="flex flex-1 items-center justify-center px-6 py-8">
      <div class="app-page-in w-full max-w-sm">
        <slot />
      </div>
    </main>

    <p class="pb-6 text-center text-xs text-dimmed">
      {{ app.tagline }}
    </p>
  </div>
</template>
