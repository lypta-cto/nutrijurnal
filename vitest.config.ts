import { defineVitestConfig } from '@nuxt/test-utils/config'

// Every test runs inside a booted Nuxt app (happy-dom): the helpers under test
// lean on auto-imports (localIsoDay, useState) and components on Nuxt UI, so
// a bare Node environment would only test the stubs. test/nuxt/ is also where
// Nuxt's generated tsconfig looks, so `nuxt typecheck` covers the tests too.
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['test/nuxt/**/*.test.ts'],
    // The people the app is for live an hour or two east of UTC; the date
    // helpers have to agree with their clock, not the machine's
    env: { TZ: 'Europe/Belgrade' },
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
        overrides: {
          // A relative API base keeps every request inside the test app, where
          // registerEndpoint answers it — no test ever reaches a real backend,
          // not even the session restore the auth middleware runs on boot
          runtimeConfig: { public: { apiBase: '/api/v1' } },
          // The service worker plugin has nothing to register in happy-dom
          pwa: { disable: true }
        }
      }
    }
  }
})
