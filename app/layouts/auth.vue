<script setup lang="ts">
/**
 * Signing in, signing up and the first-run questions: the brand on top, the
 * bowl in the morning light, and the form on a sheet that rises over it — the
 * way a phone app greets someone, at any window size.
 *
 * Onboarding and the Google hand-off get the compact top without the picture:
 * the questions need the room more than the illustration does.
 */
const { app } = useAppConfig()
const route = useRoute()

const WITH_ART = ['/login', '/register']
const withArt = computed(() => WITH_ART.includes(route.path))
</script>

<template>
  <div class="app-canvas relative flex min-h-svh flex-col overflow-x-clip">
    <div
      class="app-wash pointer-events-none absolute inset-x-0 top-0 h-[30rem]"
      aria-hidden="true"
    />

    <div class="relative mx-auto flex w-full max-w-(--app-column) flex-1 flex-col">
      <header class="app-safe-top flex items-center justify-between gap-3 px-5 pt-3">
        <ShellLogo />
        <ThemeToggle />
      </header>

      <div
        v-if="withArt"
        class="flex justify-center px-8 pt-1"
      >
        <ShellHeroArt class="animate-rise w-full max-w-[21rem]" />
      </div>

      <main
        class="relative flex flex-1 flex-col rounded-t-sheet bg-default px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-raised ring-1 ring-default"
        :class="withArt ? '-mt-3' : 'mt-6'"
      >
        <div class="app-page-in mx-auto w-full max-w-sm flex-1">
          <slot />
        </div>

        <p class="pt-8 text-center text-xs text-dimmed">
          {{ app.tagline }}
        </p>
      </main>
    </div>
  </div>
</template>
