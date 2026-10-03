<script setup lang="ts">
const { app } = useAppConfig()

// The session is restored from the API's httpOnly cookie on the client, so
// hold the app back until we know who (if anyone) is signed in — otherwise
// the diary flashes before the middleware can redirect to /login.
const { ready } = useAuth()

// The browser chrome (Android's address bar, the installed app's title bar)
// takes the canvas colour of whichever theme is showing
const colorMode = useColorMode()
const themeColor = computed(() => (colorMode.value === 'dark' ? '#0f0e0c' : '#f8f5f1'))

useHead({
  titleTemplate: title => (title ? `${title} · ${app.name}` : app.name),
  meta: [
    // `viewport-fit=cover` lets the page run under the notch; the shell pads
    // itself back in with the safe-area insets (main.css)
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: app.name },
    { name: 'theme-color', content: themeColor }
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
    <!-- The web app manifest link, from @vite-pwa/nuxt -->
    <NuxtPwaManifest />

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
