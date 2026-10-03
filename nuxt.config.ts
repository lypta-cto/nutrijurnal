// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/ui'
  ],

  // Everything meaningful sits behind auth that only the client can resolve —
  // the API's httpOnly cookie never reaches a Nuxt server, so SSR could only
  // render the signed-out shell and then fight hydration over the real UI.
  ssr: false,

  devtools: {
    enabled: true
  },

  // main.css is the design's tokens and base; motion.css the features' transitions
  css: ['~/assets/css/main.css', '~/assets/css/motion.css'],

  colorMode: {
    preference: 'system',
    fallback: 'light',
    // Namespaced: localhost storage is shared across ports, so sibling apps
    // would otherwise overwrite each other's light/dark choice
    storageKey: 'nutrijurnal-color-mode'
  },

  // Override at runtime with NUXT_PUBLIC_API_BASE
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8004/api/v1'
    }
  },

  // Nuxt's own chunk reload retries straight into a browser cache that a
  // deploy swap may have poisoned; plugins/chunk-heal.client.ts clears the
  // cache first, then reloads
  experimental: {
    emitRouteChunkError: 'manual'
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  fonts: {
    defaults: {
      weights: [400, 500, 600, 700]
    },
    families: [
      { name: 'Inter', provider: 'google' }
    ]
  }
})
