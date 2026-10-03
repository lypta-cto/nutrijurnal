<script setup lang="ts">
/**
 * Where Google sign-in lands. The route has to exist for the router to match
 * it, but nothing renders here: the auth middleware trades the cookie Google's
 * callback set for a session and moves on before this page mounts.
 */
definePageMeta({ layout: 'auth' })
</script>

<template>
  <div class="flex min-h-[50svh] items-center justify-center">
    <AppLogoMark class="size-10 animate-pulse text-primary" />
  </div>
</template>
