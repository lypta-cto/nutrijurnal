import type { Slot } from '~/composables/useEating'
import { slotForNow } from '~/composables/useEating'

/** The ways a plate gets into the diary */
export type QuickAddKind = 'search' | 'scan' | 'voice' | 'quick' | 'recipe'

export interface QuickAddOptions {
  /** The slot it goes into; the clock decides when nobody says */
  slot?: Slot
}

/**
 * The one "add food" entry point. `<QuickAddSheet />` is mounted once in the
 * default layout and reads this state, so the tab bar's "+", a page's own
 * button or an empty state can all open it without passing anything down:
 *
 *   useQuickAdd().open()                          // the sheet with every way in
 *   useQuickAdd().open('scan')                    // straight into one of them
 *   useQuickAdd().open(undefined, { slot: 'lunch' })
 *
 * `savedAt` moves whenever something was written down through it, so a page
 * that shows the diary can watch it and reload what it is showing.
 */
export function useQuickAdd() {
  const isOpen = useState<boolean>('quick-add-open', () => false)
  const kind = useState<QuickAddKind | null>('quick-add-kind', () => null)
  const slot = useState<Slot>('quick-add-slot', () => slotForNow())
  const savedAt = useState<number>('quick-add-saved-at', () => 0)

  function open(next?: QuickAddKind, options: QuickAddOptions = {}) {
    // Opening fresh picks the slot again; switching ways inside the sheet keeps it
    if (!isOpen.value || options.slot) {
      slot.value = options.slot ?? slotForNow()
    }
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

  return { isOpen, kind, slot, savedAt, open, close, markSaved }
}
