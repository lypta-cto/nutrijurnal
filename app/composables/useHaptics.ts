/**
 * A small buzz on the actions that matter — a food added, a glass drunk, a
 * swipe that deleted something. Android vibrates; iOS Safari has no
 * vibration API and simply stays still, which is fine: every one of these
 * also shows on screen.
 */
export function useHaptics() {
  function buzz(pattern: number | number[]) {
    try {
      navigator.vibrate?.(pattern)
    } catch {
      // Some browsers throw instead of ignoring when vibration is not allowed
    }
  }

  return {
    /** A light tick: a toggle, a glass, a step */
    tap: () => buzz(10),
    /** Something was written down */
    success: () => buzz(20),
    /** Something went away — a delete, an undoable loss */
    warn: () => buzz([25, 40, 25])
  }
}
