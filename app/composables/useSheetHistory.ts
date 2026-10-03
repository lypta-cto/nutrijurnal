import type { Ref } from 'vue'
import type { Router } from 'vue-router'

/**
 * The back gesture closes the sheet on top instead of leaving the page
 * under it — Android's swipe, the hardware key, the browser's Back.
 *
 * While any sheet is open, one history entry with the same address sits on
 * top of the page's own; every open sheet shares it. Going back pops it: the
 * newest sheet closes, and when another is still open under it the entry
 * goes back on. A sheet closed any other way — a tap, a swipe down, a save —
 * takes the entry back out, so history never collects dead steps, and a
 * route change waits for that, so it starts from the page's own entry.
 *
 * Call it once per sheet with the ref that opens it: `useSheetHistory(open)`.
 */

/** Marks the entry a sheet put on, among the router's own state */
const MARK = 'nutrijurnalSheet'

interface Sheet {
  close: () => void
}

/** The sheets open now, the newest last */
const openSheets: Sheet[] = []
/** The page's own entry, under ours — while ours is on top */
let under: { position: unknown, href: string } | null = null
/** Our entry being taken back out: its popstate is ours, not the router's */
let leaving: { done: () => void } | null = null
let releasing: Promise<void> | null = null
let releaseTimer: ReturnType<typeof setTimeout> | null = null
let listening = false
let installedOn: Router | null = null

function hold() {
  if (under || !openSheets.length) {
    return
  }
  if (releasing) {
    // Pushing now would race the traversal still taking the old entry out
    void releasing.then(hold)
    return
  }
  under = { position: history.state?.position, href: location.href }
  history.pushState({ ...history.state, [MARK]: true }, '')
}

/** Takes our entry back out; resolves once the browser is on the page's own */
function release(): Promise<void> {
  if (releaseTimer) {
    clearTimeout(releaseTimer)
    releaseTimer = null
  }
  if (!under) {
    return releasing ?? Promise.resolve()
  }
  under = null
  let finish = () => {}
  const released = new Promise<void>((resolve) => {
    finish = resolve
  })
  const done = () => {
    if (leaving?.done === done) {
      leaving = null
      releasing = null
      finish()
    }
  }
  // Set before going back: some browsers answer the traversal at once
  leaving = { done }
  releasing = released
  history.back()
  // A browser that never answers the traversal must not hold navigation up
  setTimeout(done, 1000)
  return released
}

function onPopState(event: PopStateEvent) {
  if (leaving) {
    // The entry we took out ourselves: nothing moved for the router
    event.stopImmediatePropagation()
    leaving.done()
    return
  }
  const page = under
  if (!page) {
    return
  }
  under = null
  if (event.state?.position === page.position && location.href === page.href) {
    // Back onto the page's own entry: only the newest sheet goes, and the
    // one under it, if any, gets its own way back
    event.stopImmediatePropagation()
    openSheets.pop()?.close()
    hold()
    return
  }
  // A jump past our entry (a long press on Back, an entry the browser
  // skipped): a real navigation for the router, and the sheets go with it
  openSheets.splice(0).reverse().forEach(sheet => sheet.close())
}

function opened(sheet: Sheet) {
  if (!openSheets.includes(sheet)) {
    openSheets.push(sheet)
  }
  // One sheet handed over to the next in the same moment keeps the entry
  if (releaseTimer) {
    clearTimeout(releaseTimer)
    releaseTimer = null
  }
  hold()
}

function closed(sheet: Sheet) {
  const index = openSheets.indexOf(sheet)
  if (index === -1) {
    return
  }
  openSheets.splice(index, 1)
  if (openSheets.length) {
    // The sheet under it keeps a way back
    hold()
    return
  }
  if (under && !releaseTimer) {
    // Left a moment, in case another sheet opens in its place
    releaseTimer = setTimeout(() => void release(), 0)
  }
}

function install(router: Router) {
  if (!listening) {
    listening = true
    // Capture: on the window itself this runs before the router's own listener
    window.addEventListener('popstate', onPopState, { capture: true })
  }
  if (installedOn === router) {
    return
  }
  installedOn = router
  router.beforeEach(async () => {
    // Already off our entry: this is the Back that left it, being handled
    if (under && history.state?.[MARK] !== true) {
      return
    }
    await release()
  })
  router.afterEach(() => hold())
}

export function useSheetHistory(open: Ref<boolean>) {
  if (import.meta.server) {
    return
  }
  install(useRouter())
  const sheet: Sheet = {
    close: () => {
      open.value = false
    }
  }
  watch(open, isOpen => (isOpen ? opened(sheet) : closed(sheet)), { immediate: true })
  // A page left with its sheet open takes the sheet with it
  onBeforeUnmount(() => closed(sheet))
}
