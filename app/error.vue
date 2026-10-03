<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * Something broke, or the address leads nowhere: said calmly, in the app's
 * own look, with the one way back. A missing page is a wrong turn; anything
 * else is the app's fault, not the reader's.
 */
const props = defineProps<{ error: NuxtError }>()

const notFound = computed(() => props.error.statusCode === 404)
</script>

<template>
  <UApp>
    <div class="app-canvas relative flex min-h-svh flex-col overflow-x-clip">
      <div
        class="app-wash pointer-events-none absolute inset-x-0 top-0 h-80"
        aria-hidden="true"
      />

      <div class="app-safe-top relative mx-auto flex w-full max-w-(--app-column) flex-1 flex-col px-4">
        <header class="flex items-center px-1 pt-3">
          <ShellLogo />
        </header>

        <main class="flex flex-1 items-center pb-[max(2rem,env(safe-area-inset-bottom))]">
          <ShellCard class="w-full motion-safe:animate-rise">
            <ShellEmpty
              :icon="notFound ? 'i-lucide-map-pin-off' : 'i-lucide-cloud-alert'"
              :title="notFound ? 'This page isn\'t here' : 'Something went wrong'"
              :description="notFound
                ? 'The link may be old, or mistyped. Your diary is just where you left it.'
                : (error.statusMessage || 'The app hit a problem it didn\'t expect. Going back usually sorts it out.')"
            >
              <UButton
                label="Back to today"
                icon="i-lucide-arrow-left"
                size="lg"
                @click="clearError({ redirect: '/' })"
              />
            </ShellEmpty>
            <p class="pb-5 text-center text-caption font-semibold tracking-[0.08em] text-dimmed uppercase tabular-nums">
              Error {{ error.statusCode }}
            </p>
          </ShellCard>
        </main>
      </div>
    </div>
  </UApp>
</template>
