// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/ui',
    '@vite-pwa/nuxt'
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
  },

  // An installable app with an offline shell. The manifest's colours are the
  // design's canvas (docs/design.md); the icons are the contract paths under
  // public/icons. The generated worker also imports public/push-sw.js, which
  // shows the reminders.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      id: '/',
      name: 'Nutrijurnal',
      short_name: 'Nutrijurnal',
      description: 'A food diary for every day: log a meal in a few taps, scan a packet, say it out loud.',
      lang: 'en',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#f8f5f1',
      background_color: '#f8f5f1',
      categories: ['health', 'food', 'lifestyle'],
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ],
      shortcuts: [
        { name: 'Add food', short_name: 'Add', url: '/?add=now', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }
      ]
    },
    workbox: {
      // A single-page app: every navigation is answered by the shell
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
      importScripts: ['/push-sw.js'],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          // The pantry, recipes and days already opened stay readable offline.
          // The API is another origin, so this matches on the path; the
          // cache is cleared on sign-out (useAuth), never shared between people.
          urlPattern: ({ url }) => /\/api\/v1\/eating\/(foods|recipes|days)/.test(url.pathname),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'nutrijurnal-api',
            networkTimeoutSeconds: 4,
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
            cacheableResponse: { statuses: [200] }
          }
        },
        {
          // The barcode decoder for browsers without a native one — big, and
          // fetched only by the phones that need it, then kept
          urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'nutrijurnal-wasm',
            expiration: { maxEntries: 4 },
            cacheableResponse: { statuses: [200] }
          }
        }
      ]
    },
    client: {
      // The browser's own install banner waits; the app offers it at a calm moment
      installPrompt: 'nutrijurnal-hide-install'
    },
    // Off in development — a worker caching a dev server only confuses. Flip
    // it on locally to try notifications or the install prompt against :3400.
    devOptions: {
      enabled: false,
      type: 'module',
      navigateFallback: '/'
    }
  }
})
