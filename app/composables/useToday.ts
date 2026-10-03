/**
 * Today's date in the viewer's own clock, kept current.
 *
 * An installed app stays in memory for days. A date read once at start-up
 * still says yesterday the next morning — and the "+" writes breakfast onto
 * it. `plugins/today.client.ts` moves this along when the app wakes, gets
 * focus, or passes midnight while open; read it wherever "today" decides
 * something, rather than calling `localIsoDay()` once and keeping the answer.
 */
export function useToday() {
  return useState<string>('today', () => localIsoDay())
}

/**
 * The day the diary is open on — Today, the quick-add sheet and the forms
 * all write to it. It starts on today and, while it is still on today, it
 * moves with it at midnight (see `followToday`).
 */
export function useDiaryDay() {
  return useState<string>('eating-day', () => localIsoDay())
}

/**
 * Checks the clock and moves today on when the date changed. The diary's day
 * goes along only when it was on today: someone reading last Tuesday stays
 * on last Tuesday. Returns whether anything changed.
 */
export function followToday(now = new Date()): boolean {
  const today = useToday()
  const day = useDiaryDay()
  const current = localIsoDay(now)
  if (current === today.value) {
    return false
  }
  const was = today.value
  today.value = current
  if (day.value === was) {
    day.value = current
  }
  return true
}
