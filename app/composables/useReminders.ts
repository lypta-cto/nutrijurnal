import type { Slot } from '~/composables/useEating'
import { SLOTS, slotLabel } from '~/composables/useEating'

export type ReminderKind = 'meal' | 'water' | 'summary'

export interface Reminder {
  id: string
  kind: ReminderKind
  /** Which meal, for a meal reminder */
  slot: Slot | null
  /** "08:00:00" in the person's own clock */
  at: string
  /** Monday is 0 */
  weekdays: number[]
  enabled: boolean
  last_sent_on: string | null
}

export interface ReminderPayload {
  kind: ReminderKind
  slot?: Slot | null
  at: string
  weekdays?: number[]
  enabled?: boolean
}

/** What can be asked for, at the hour it is usually wanted */
export const REMINDER_PRESETS: { label: string, icon: string, payload: ReminderPayload }[] = [
  { label: 'Breakfast', icon: 'i-lucide-coffee', payload: { kind: 'meal', slot: 'breakfast', at: '08:00' } },
  { label: 'Lunch', icon: 'i-lucide-salad', payload: { kind: 'meal', slot: 'lunch', at: '13:00' } },
  { label: 'Dinner', icon: 'i-lucide-utensils', payload: { kind: 'meal', slot: 'dinner', at: '19:00' } },
  { label: 'Snack', icon: 'i-lucide-apple', payload: { kind: 'meal', slot: 'snack', at: '16:00' } },
  { label: 'Water', icon: 'i-lucide-glass-water', payload: { kind: 'water', at: '11:00' } },
  { label: 'Daily summary', icon: 'i-lucide-chart-no-axes-column', payload: { kind: 'summary', at: '21:00' } }
]

/** The set offered to someone with no reminders yet */
export const SUGGESTED_REMINDERS: ReminderPayload[] = [
  { kind: 'meal', slot: 'breakfast', at: '08:30' },
  { kind: 'meal', slot: 'lunch', at: '13:30' },
  { kind: 'meal', slot: 'dinner', at: '19:30' },
  { kind: 'water', at: '11:00' },
  { kind: 'water', at: '16:00' },
  { kind: 'summary', at: '21:00' }
]

export function reminderLabel(reminder: Pick<Reminder, 'kind' | 'slot'>): string {
  if (reminder.kind === 'water') {
    return 'Water'
  }
  if (reminder.kind === 'summary') {
    return 'Daily summary'
  }
  return slotLabel(reminder.slot ?? 'snack')
}

export function reminderIcon(reminder: Pick<Reminder, 'kind' | 'slot'>): string {
  if (reminder.kind === 'water') {
    return 'i-lucide-glass-water'
  }
  if (reminder.kind === 'summary') {
    return 'i-lucide-chart-no-axes-column'
  }
  return SLOTS.find(entry => entry.value === reminder.slot)?.icon ?? 'i-lucide-utensils'
}

export function useReminders() {
  const api = useApi()

  return {
    list: () => api.get<Reminder[]>('/reminders'),
    create: (payload: ReminderPayload) => api.post<Reminder>('/reminders', { ...payload }),
    update: (id: string, patch: Partial<Omit<ReminderPayload, 'kind'>>) => api.patch<Reminder>(`/reminders/${id}`, { ...patch }),
    remove: (id: string) => api.del(`/reminders/${id}`)
  }
}
