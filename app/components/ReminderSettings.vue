<script setup lang="ts">
import type { Reminder, ReminderPayload } from '~/composables/useReminders'
import { REMINDER_PRESETS, SUGGESTED_REMINDERS, reminderIcon, reminderLabel } from '~/composables/useReminders'
import { browserTimezone, isIos } from '~/composables/usePush'

/**
 * Reminders: notifications on this device, and what to be reminded of.
 *
 * The list can be built whatever the device can do — the reminders live on
 * the server and go to every device that has notifications on. The status
 * at the top says plainly what stands in the way when this one cannot
 * receive them (an iPhone needs the app on the Home Screen first).
 */
const push = usePush()
const { list, create, update, remove } = useReminders()
const { saveSettings } = useEating()
const toast = useToast()

const reminders = ref<Reminder[]>([])
const loading = ref(true)
const testing = ref(false)

onMounted(async () => {
  await Promise.all([
    push.check(),
    list().then((rows) => {
      reminders.value = rows
    }).catch(() => {})
  ])
  loading.value = false
})

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

async function turnOn() {
  try {
    await push.enable()
    if (push.state.value === 'on') {
      toast.add({ title: 'Notifications are on', icon: 'i-lucide-bell-ring', color: 'success' })
    }
  } catch (error) {
    fail(error)
  }
}

async function turnOff() {
  try {
    await push.disable()
  } catch (error) {
    fail(error)
  }
}

async function sendTest() {
  testing.value = true
  try {
    const result = await push.test()
    toast.add({
      title: result.sent ? 'Test sent — it should arrive in a moment' : 'Nothing could be delivered',
      icon: result.sent ? 'i-lucide-send' : 'i-lucide-circle-alert',
      color: result.sent ? 'success' : 'warning'
    })
  } catch (error) {
    fail(error)
  } finally {
    testing.value = false
  }
}

const ordered = computed(() => [...reminders.value].sort((a, b) => a.at.localeCompare(b.at)))

async function add(payload: ReminderPayload) {
  try {
    reminders.value = [...reminders.value, await create(payload)]
    // Reminders go out in the person's own clock — make sure the API knows it
    await saveSettings({ timezone: browserTimezone() }).catch(() => {})
  } catch (error) {
    fail(error)
  }
}

async function addSuggested() {
  for (const payload of SUGGESTED_REMINDERS) {
    await add(payload)
  }
}

async function change(reminder: Reminder, patch: Partial<Pick<Reminder, 'at' | 'enabled' | 'weekdays'>>) {
  const before = { ...reminder }
  Object.assign(reminder, patch)
  try {
    Object.assign(reminder, await update(reminder.id, patch))
  } catch (error) {
    Object.assign(reminder, before)
    fail(error)
  }
}

function setTime(reminder: Reminder, value: string) {
  if (value && value !== reminder.at.slice(0, 5)) {
    void change(reminder, { at: value })
  }
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function toggleDay(reminder: Reminder, day: number) {
  const days = reminder.weekdays.includes(day)
    ? reminder.weekdays.filter(entry => entry !== day)
    : [...reminder.weekdays, day].sort()
  if (!days.length) {
    toast.add({ title: 'A reminder needs at least one day', icon: 'i-lucide-circle-help', color: 'warning' })
    return
  }
  void change(reminder, { weekdays: days })
}

async function drop(reminder: Reminder) {
  try {
    await remove(reminder.id)
    reminders.value = reminders.value.filter(entry => entry.id !== reminder.id)
    toast.add({
      title: `${reminderLabel(reminder)} reminder removed`,
      icon: 'i-lucide-trash-2',
      color: 'neutral',
      actions: [{
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: () => void add({
          kind: reminder.kind,
          slot: reminder.slot,
          at: reminder.at.slice(0, 5),
          weekdays: reminder.weekdays,
          enabled: reminder.enabled
        })
      }]
    })
  } catch (error) {
    fail(error)
  }
}

const addItems = computed(() => [REMINDER_PRESETS.map(preset => ({
  label: preset.label,
  icon: preset.icon,
  onSelect: () => void add(preset.payload)
}))])

/** What stands between this device and a notification, in plain words */
const status = computed<{ title: string, description: string, icon: string, color: 'neutral' | 'warning' | 'info' } | null>(() => {
  switch (push.state.value) {
    case 'install':
      return {
        title: 'Add Nutrijurnal to your Home Screen first',
        description: 'On iPhone and iPad, notifications only work in the installed app: tap Share, then “Add to Home Screen”, and open it from there.',
        icon: 'i-lucide-smartphone',
        color: 'info'
      }
    case 'unsupported':
      return {
        title: 'This browser can\'t show notifications',
        description: isIos()
          ? 'Update to iOS 16.4 or later and open Nutrijurnal from the Home Screen.'
          : 'Try Chrome, Edge, Firefox or Safari — your reminders are saved and will reach any device that can.',
        icon: 'i-lucide-bell-off',
        color: 'neutral'
      }
    case 'server-off':
      return {
        title: 'Reminders aren\'t set up on this server yet',
        description: 'You can still plan them here; they start arriving once notifications are switched on for Nutrijurnal.',
        icon: 'i-lucide-server-off',
        color: 'neutral'
      }
    case 'denied':
      return {
        title: 'Notifications are blocked',
        description: 'Allow notifications for this site in your browser or phone settings, then come back here.',
        icon: 'i-lucide-bell-off',
        color: 'warning'
      }
    default:
      return null
  }
})
</script>

<template>
  <section class="app-card flex flex-col gap-3 px-4 py-4">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <h2 class="flex items-center gap-2 font-semibold text-highlighted">
          <UIcon
            name="i-lucide-bell"
            class="size-4 text-muted"
          />
          Reminders
        </h2>
        <p class="mt-0.5 text-sm text-muted">
          A nudge at meal times, for water, and a summary of the day.
        </p>
      </div>
    </div>

    <USkeleton
      v-if="push.state.value === 'checking'"
      class="h-10 w-full"
    />
    <UAlert
      v-else-if="status"
      :title="status.title"
      :description="status.description"
      :icon="status.icon"
      :color="status.color"
      variant="subtle"
    />
    <div
      v-else-if="push.state.value === 'off'"
      class="flex flex-col gap-2 rounded-xl bg-elevated/60 p-3"
    >
      <p class="text-sm text-default">
        Notifications are off on this device.
      </p>
      <UButton
        label="Turn on notifications"
        icon="i-lucide-bell-ring"
        :loading="push.busy.value"
        block
        @click="turnOn"
      />
    </div>
    <div
      v-else
      class="flex flex-wrap items-center gap-2 rounded-xl bg-success/10 px-3 py-2"
    >
      <UIcon
        name="i-lucide-bell-ring"
        class="size-4 text-success"
      />
      <span class="min-w-0 flex-1 text-sm text-default">On for this device</span>
      <UButton
        label="Send a test"
        size="xs"
        color="neutral"
        variant="subtle"
        :loading="testing"
        @click="sendTest"
      />
      <UButton
        label="Turn off"
        size="xs"
        color="neutral"
        variant="ghost"
        :loading="push.busy.value"
        @click="turnOff"
      />
    </div>

    <div
      v-if="loading"
      class="flex flex-col gap-2"
    >
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-12 w-full"
      />
    </div>

    <div
      v-else-if="!reminders.length"
      class="flex flex-col items-center gap-2 py-2 text-center"
    >
      <p class="text-sm text-muted">
        No reminders yet.
      </p>
      <UButton
        label="Add the usual set"
        icon="i-lucide-sparkles"
        variant="soft"
        @click="addSuggested"
      />
      <p class="text-[11px] text-dimmed">
        Breakfast, lunch, dinner, two for water and an evening summary — change any of them after.
      </p>
    </div>

    <TransitionGroup
      v-else
      tag="ul"
      name="list"
      class="flex flex-col divide-y divide-default"
    >
      <li
        v-for="reminder in ordered"
        :key="reminder.id"
        class="flex flex-col gap-2 py-2.5"
      >
        <div class="flex items-center gap-2">
          <UIcon
            :name="reminderIcon(reminder)"
            class="size-4 shrink-0"
            :class="reminder.enabled ? 'text-primary' : 'text-dimmed'"
          />
          <span
            class="min-w-0 flex-1 truncate text-sm font-medium"
            :class="reminder.enabled ? 'text-highlighted' : 'text-muted'"
          >{{ reminderLabel(reminder) }}</span>
          <input
            :value="reminder.at.slice(0, 5)"
            type="time"
            class="rounded-md border border-default bg-default px-2 py-1 text-sm tabular-nums text-default"
            :aria-label="`Time for the ${reminderLabel(reminder)} reminder`"
            @change="event => setTime(reminder, (event.target as HTMLInputElement).value)"
          >
          <USwitch
            :model-value="reminder.enabled"
            :aria-label="`${reminderLabel(reminder)} reminder on`"
            @update:model-value="value => change(reminder, { enabled: Boolean(value) })"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="neutral"
            variant="ghost"
            square
            :aria-label="`Remove the ${reminderLabel(reminder)} reminder`"
            @click="drop(reminder)"
          />
        </div>
        <div
          class="flex gap-1 pl-6"
          role="group"
          :aria-label="`Days for the ${reminderLabel(reminder)} reminder`"
        >
          <button
            v-for="(letter, day) in DAYS"
            :key="day"
            type="button"
            class="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors"
            :class="reminder.weekdays.includes(day) ? 'bg-primary/15 text-primary' : 'bg-elevated text-dimmed'"
            :aria-label="DAY_NAMES[day]"
            :aria-pressed="reminder.weekdays.includes(day)"
            @click="toggleDay(reminder, day)"
          >
            {{ letter }}
          </button>
        </div>
      </li>
    </TransitionGroup>

    <UDropdownMenu
      v-if="!loading && reminders.length"
      :items="addItems"
      :content="{ align: 'start' }"
    >
      <UButton
        label="Add a reminder"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        class="self-start"
      />
    </UDropdownMenu>
  </section>
</template>
