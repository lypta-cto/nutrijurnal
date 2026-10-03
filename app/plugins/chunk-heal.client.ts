import { joinURL } from 'ufo'

/**
 * Self-heal for a deploy caught mid-swap.
 *
 * Vercel answers a `/_nuxt/*` file that isn't there (yet, or any more) with
 * the SPA's index.html — as a 200 carrying the year-long immutable header
 * meant for real chunks. A browser that asks at the wrong second keeps that
 * HTML under the chunk's URL, and from then on the page dies with "500 —
 * Failed to fetch dynamically imported module". A plain reload can't fix it:
 * it reads the same cached copy. So refetch every build asset the page has
 * touched, bypassing the cache — which overwrites the bad entry — and only
 * then reload.
 *
 * Replaces Nuxt's built-in chunk reload (`emitRouteChunkError: 'manual'` in
 * nuxt.config), including its reload-on-new-build behaviour.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()
  const config = useRuntimeConfig()

  function reloadAt(fullPath: string) {
    // The ttl stops a loop when a deploy really is broken: one attempt, then
    // the error page stays up
    reloadNuxtApp({ path: joinURL(config.app.baseURL, fullPath), persistState: true, ttl: 10_000 })
  }

  // A new build went live while this tab was open — the next navigation
  // loads it fresh instead of asking for chunks that no longer exist
  useNuxtApp().hook('app:manifest:update', () => {
    router.beforeResolve(to => reloadAt(to.fullPath))
  })

  router.onError((error, to) => {
    if (isChunkError(error)) {
      void refreshBuildAssets(error).finally(() => reloadAt(to.fullPath))
    }
  })
})

function isChunkError(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error)
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message)
}

async function refreshBuildAssets(error: unknown) {
  const assets = new Set<string>()

  // Everything the module graph pulled in, cached or not — the bad entry is
  // usually a dependency of the chunk named in the error, not the chunk itself
  for (const entry of performance.getEntriesByType('resource')) {
    if (entry.name.includes('/_nuxt/')) {
      assets.add(entry.name)
    }
  }
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"][href*="/_nuxt/"]')
    .forEach(link => assets.add(link.href))

  const named = String((error as Error)?.message ?? '').match(/https?:\/\/\S+?\/_nuxt\/\S+?\.js/)
  if (named) {
    assets.add(named[0])
  }

  await Promise.allSettled([...assets].map(url => fetch(url, { cache: 'reload' })))
}
