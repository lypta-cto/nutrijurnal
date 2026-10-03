/**
 * Every form is a bottom sheet: thumb-reachable, dismissed with a swipe down,
 * the same width as the app's column on a desktop. Spread into a UDrawer's
 * `ui` (and add to it where a sheet needs more).
 *
 * The sheet's container is what scrolls (app.config.ts → drawer), so the
 * header and footer stay put as glass with the body passing under them. A
 * body given its own `overflow-y-auto` scrolls on its own instead, and the
 * header and footer simply stay plain.
 */
export const SHEET_UI = {
  content: 'mx-auto w-full max-w-(--app-column) max-h-[92svh]'
}
