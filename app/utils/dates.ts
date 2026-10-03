/** Today as YYYY-MM-DD in the viewer's own timezone (not UTC) — a meal eaten
 *  at 00:30 belongs to the day the person is living in, not to London's */
export function localIsoDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Why a meal can't go on this day, or null when it can. A date field's `max`
 * is only a hint — iOS's date wheel ignores it and offers next week — and a
 * day after today is one Today never opens, so a meal put there would vanish.
 * The API refuses it too; saying so here keeps the sheet open to fix it.
 */
export function dayRefusal(day: string, today: string): string | null {
  if (!day) {
    return 'Pick a day'
  }
  if (day > today) {
    return 'That day hasn\'t come yet — pick today or an earlier day'
  }
  return null
}

/**
 * Opens a date field's calendar where a click alone would not. A desktop
 * browser opens it only from the field's own small icon, which the app hides
 * under the day's name; a phone opens it on any tap and is left to do so.
 */
export function showDatePicker(event: Event) {
  const field = event.currentTarget as HTMLInputElement | null
  if (!field?.showPicker || !window.matchMedia?.('(pointer: fine)').matches) {
    return
  }
  try {
    field.showPicker()
  } catch {
    // Refused (inside a cross-origin frame, say) — the field still takes typing
  }
}
