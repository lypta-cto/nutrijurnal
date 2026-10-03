/** The ways a plate gets into the diary */
export type QuickAddKind = 'search' | 'scan' | 'voice' | 'quick' | 'recipe'

/**
 * The one "add food" entry point. `<QuickAddSheet />` is mounted once in the
 * default layout and reads this state, so the tab bar's "+", a page's own
 * button or an empty state can all open it without passing anything down:
 *
 *   useQuickAdd().open()          // the sheet with every way in
 *   useQuickAdd().open('scan')    // straight into one of them
 *
 * `savedAt` moves whenever something was written down through it, so a page
 * that shows the diary can watch it and reload what it is showing.
 */
export function useQuickAdd() {
  const isOpen = useState<boolean>('quick-add-open', () => false)
  const kind = useState<QuickAddKind | null>('quick-add-kind', () => null)
  const savedAt = useState<number>('quick-add-saved-at', () => 0)

  function open(next?: QuickAddKind) {
    kind.value = next ?? null
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    kind.value = null
  }

  function markSaved() {
    savedAt.value = Date.now()
  }

  return { isOpen, kind, savedAt, open, close, markSaved }
}
