/**
 * Whether the person asked their device for less motion. Everything that
 * moves on its own — count-ups, swipes settling, rings filling — checks this
 * and lands on its final state at once instead.
 */
export function useReducedMotion() {
  const reduced = useState<boolean>('reduced-motion', () => false)

  onMounted(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) {
      return
    }
    reduced.value = query.matches
    const follow = (event: MediaQueryListEvent) => {
      reduced.value = event.matches
    }
    query.addEventListener('change', follow)
    onBeforeUnmount(() => query.removeEventListener('change', follow))
  })

  return reduced
}
