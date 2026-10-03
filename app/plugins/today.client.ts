/**
 * Keeps "today" current for an app that is never closed (composables/useToday.ts).
 *
 * A phone suspends the page's timers in the background, so waking up is the
 * moment that matters most: the page coming back into view, getting focus,
 * or being restored from the back-forward cache. The minute timer covers a
 * screen left open across midnight.
 */
export default defineNuxtPlugin(() => {
  const check = () => {
    followToday()
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      check()
    }
  })
  window.addEventListener('focus', check)
  window.addEventListener('pageshow', check)
  setInterval(check, 60_000)
})
