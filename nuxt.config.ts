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

  // Tabs cross-fade; the styles are in motion.css (and stand still under
  // prefers-reduced-motion)
  app: {
    pageTransition: { name: 'page', mode: 'out-in' }
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

  // A build for production talks to its own origin: vercel.json rewrites
  // /api/* to the API, which keeps the refresh cookie first-party. The dev
  // server talks to the API on :8004. NUXT_PUBLIC_API_BASE overrides both.
  runtimeConfig: {
    public: {
      apiBase: process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:8004/api/v1'
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

  // Plus Jakarta Sans and Fraunces are found in main.css's --font-sans and
  // --font-display and served by @nuxt/fonts; nothing to list here
  fonts: {
    defaults: {
      weights: [400, 500, 600, 700]
    }
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
      // A single-page app: every navigation is answered by the shell —
      // except the API and uploads, which the rewrite sends on to the server
      // (an export link, a profile photo opened in its own tab)
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
      importScripts: ['/push-sw.js'],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          // The pantry, recipes and days already opened stay readable offline.
          // Matched on the path, so it holds whether the API is reached
          // through the rewrite (production) or on :8004 (development); the
          // cache is cleared on sign-out (useAuth), never shared between people.
          urlPattern: ({ url }) => /\/api\/v1\/eating\/(foods|recipes|days)/.test(url.pathname),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'nutrijurnal-api',
            // Offline fails at once and reads the cache at once; this only
            // decides how long a slow answer is waited for. The day is
            // re-read right after every meal is written, so a short wait
            // served the copy from before the write — the new meal looked
            // lost on a slow connection, and people logged it twice.
            networkTimeoutSeconds: 10,
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
