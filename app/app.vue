<script setup lang="ts">
const { app } = useAppConfig()

// The session is restored from the API's httpOnly cookie on the client, so
// hold the app back until we know who (if anyone) is signed in — otherwise
// the diary flashes before the middleware can redirect to /login.
const { ready } = useAuth()

// The browser chrome (Android's address bar, the installed app's title bar)
// takes the canvas colour of whichever theme is showing
const colorMode = useColorMode()
const themeColor = computed(() => (colorMode.value === 'dark' ? '#000000' : '#f2f2f7'))

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
  <!-- Toasts come in under the notch, not behind it -->
  <UApp :toaster="{ position: 'top-center', ui: { viewport: 'top-[max(1rem,env(safe-area-inset-top))]' } }">
    <!-- The web app manifest link, from @vite-pwa/nuxt -->
    <NuxtPwaManifest />

    <NuxtLayout v-if="ready">
      <NuxtPage />
    </NuxtLayout>

    <div
      v-else
      class="app-canvas flex min-h-svh items-center justify-center"
      role="status"
      aria-label="Opening Nutrijurnal"
    >
      <ShellLogoMark class="size-12 motion-safe:animate-pulse" />
    </div>
  </UApp>
</template>
