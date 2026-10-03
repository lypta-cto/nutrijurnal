/** Today as YYYY-MM-DD in the viewer's own timezone (not UTC) — a meal eaten
 *  at 00:30 belongs to the day the person is living in, not to London's */
export function localIsoDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
