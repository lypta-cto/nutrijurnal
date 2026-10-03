<script setup lang="ts">
const { app } = useAppConfig()

// The session is restored from the API's httpOnly cookie on the client, so
// hold the app back until we know who (if anyone) is signed in — otherwise
// the diary flashes before the middleware can redirect to /login.
const { ready } = useAuth()

useHead({
  titleTemplate: title => (title ? `${title} · ${app.name}` : app.name),
  meta: [
    // `viewport-fit=cover` lets the page run under the notch; the shell pads
    // itself back in with the safe-area insets (main.css)
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: app.name }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtLayout v-if="ready">
      <NuxtPage />
    </NuxtLayout>

    <div
      v-else
      class="app-canvas flex min-h-svh items-center justify-center"
    >
      <AppLogoMark class="size-10 animate-pulse text-primary" />
    </div>
  </UApp>
</template>
