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
    <div class="flex min-h-svh flex-col bg-plain">
      <div class="app-safe-top mx-auto flex w-full max-w-(--app-column) flex-1 flex-col px-4">
        <header class="flex items-center px-2 pt-3">
          <ShellLogo size="sm" />
        </header>

        <main class="flex flex-1 flex-col items-center justify-center pb-[max(2rem,env(safe-area-inset-bottom))] motion-safe:animate-rise">
          <ShellEmpty
            :icon="notFound ? 'i-lucide-map-pin-off' : 'i-lucide-cloud-alert'"
            :title="notFound ? 'This page isn\'t here' : 'Something went wrong'"
            :description="notFound
              ? 'The link may be old, or mistyped. Your diary is just where you left it.'
              : (error.statusMessage || 'The app hit a problem it didn\'t expect. Going back usually sorts it out.')"
          >
            <UButton
              label="Back to today"
              size="lg"
              @click="clearError({ redirect: '/' })"
            />
          </ShellEmpty>
          <p class="text-footnote text-dimmed tabular-nums">
            Error {{ error.statusCode }}
          </p>
        </main>
      </div>
    </div>
  </UApp>
</template>
