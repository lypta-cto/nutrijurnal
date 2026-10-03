<script setup lang="ts">
/**
 * Signing in, signing up, the first-run questions and the Google hand-off: a
 * plain screen with the wordmark at the top, the form in a narrow column with
 * plenty of air around it, and the tagline as a footnote at the bottom.
 * Nothing decorative — the form is the whole point of the screen.
 */
const { app } = useAppConfig()
</script>

<template>
  <div class="flex min-h-svh flex-col bg-plain">
    <div class="mx-auto flex w-full max-w-md flex-1 flex-col px-6">
      <header class="app-safe-top flex items-center justify-between gap-3 pt-3">
        <ShellLogo size="sm" />
        <ThemeToggle />
      </header>

      <main class="app-page-in flex flex-1 flex-col pt-10 pb-10">
        <slot />
      </main>

      <p class="pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-footnote text-dimmed">
        {{ app.tagline }}
      </p>
    </div>
  </div>
</template>
