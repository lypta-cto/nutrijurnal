/**
 * Every form is a bottom sheet: thumb-reachable, dismissed with a swipe down,
 * the same width as the app's column on a desktop. Spread into a UDrawer's
 * `ui` (and add to it where a sheet needs more).
 */
export const SHEET_UI = {
  content: 'mx-auto w-full max-w-(--app-column) max-h-[92svh]',
  body: 'overflow-y-auto',
  // The last thing in the sheet keeps clear of the home indicator
  footer: 'app-safe-bottom'
}
