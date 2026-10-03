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
  <ShellCard
    flush
    aria-label="Reminders"
  >
    <!-- This device first: what stands in the way, or the switch -->
    <div class="px-4 py-3.5">
      <ShellSkeleton
        v-if="push.state.value === 'checking'"
        variant="text"
        :count="2"
      />
      <UAlert
        v-else-if="status"
        :title="status.title"
        :description="status.description"
        :icon="status.icon"
        :color="status.color"
        variant="soft"
      />
      <div
        v-else-if="push.state.value === 'off'"
        class="flex items-center gap-3"
      >
        <span class="flex w-6 shrink-0 justify-center text-muted">
          <UIcon
            name="i-lucide-bell-off"
            class="size-5.5"
          />
        </span>
        <span class="min-w-0 flex-1 text-body text-default">Notifications are off on this device.</span>
        <UButton
          label="Turn on"
          size="sm"
          class="app-hit"
          :loading="push.busy.value"
          @click="turnOn"
        />
      </div>
      <div
        v-else
        class="flex flex-wrap items-center gap-x-3 gap-y-2"
      >
        <span class="flex w-6 shrink-0 justify-center text-primary">
          <UIcon
            name="i-lucide-bell-ring"
            class="size-5.5"
          />
        </span>
        <span class="min-w-0 flex-1 text-body text-highlighted">On for this device</span>
        <span class="flex gap-1">
          <UButton
            label="Test"
            icon="i-lucide-send"
            size="sm"
            color="neutral"
            variant="soft"
            class="app-hit"
            :loading="testing"
            @click="sendTest"
          />
          <UButton
            label="Turn off"
            size="sm"
            color="neutral"
            variant="ghost"
            class="app-hit"
            :loading="push.busy.value"
            @click="turnOff"
          />
        </span>
      </div>
    </div>

    <ShellSkeleton
      v-if="loading"
      variant="rows"
      :count="3"
    />

    <ShellEmpty
      v-else-if="!reminders.length"
      icon="i-lucide-bell-plus"
      title="No reminders yet"
      description="Breakfast, lunch, dinner, two for water and an evening summary — change any of them after."
    >
      <UButton
        label="Add the usual set"
        icon="i-lucide-plus"
        @click="addSuggested"
      />
    </ShellEmpty>

    <TransitionGroup
      v-else
      tag="ul"
      name="list"
      class="app-divide flex flex-col"
    >
      <li
        v-for="reminder in ordered"
        :key="reminder.id"
        class="flex flex-col gap-2.5 px-4 py-3"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex w-6 shrink-0 justify-center transition-colors duration-200 ease-soft motion-reduce:transition-none"
            :class="reminder.enabled ? 'text-muted' : 'text-dimmed'"
          >
            <UIcon
              :name="reminderIcon(reminder)"
              class="size-5.5"
            />
          </span>
          <span
            class="min-w-0 flex-1 truncate text-body"
            :class="reminder.enabled ? 'text-highlighted' : 'text-muted'"
          >{{ reminderLabel(reminder) }}</span>
          <input
            :value="reminder.at.slice(0, 5)"
            type="time"
            class="app-field h-9 w-[5.75rem] shrink-0 px-2.5 text-center"
            :aria-label="`Time for the ${reminderLabel(reminder)} reminder`"
            @change="event => setTime(reminder, (event.target as HTMLInputElement).value)"
          >
          <USwitch
            :model-value="reminder.enabled"
            :aria-label="`${reminderLabel(reminder)} reminder on`"
            @update:model-value="value => change(reminder, { enabled: Boolean(value) })"
          />
        </div>
        <div class="flex items-center justify-between gap-2">
          <div
            class="flex gap-1.5"
            role="group"
            :aria-label="`Days for the ${reminderLabel(reminder)} reminder`"
          >
            <button
              v-for="(letter, day) in DAYS"
              :key="day"
              type="button"
              class="app-chip app-chip-quiet size-8 px-0 text-footnote"
              :aria-label="DAY_NAMES[day]"
              :aria-pressed="reminder.weekdays.includes(day)"
              @click="toggleDay(reminder, day)"
            >
              {{ letter }}
            </button>
          </div>
          <UButton
            icon="i-lucide-trash-2"
            size="sm"
            color="neutral"
            variant="ghost"
            square
            class="app-hit text-dimmed"
            :aria-label="`Remove the ${reminderLabel(reminder)} reminder`"
            @click="drop(reminder)"
          />
        </div>
      </li>
    </TransitionGroup>

    <template
      v-if="!loading && reminders.length"
      #footer
    >
      <UDropdownMenu
        :items="addItems"
        :content="{ align: 'start' }"
      >
        <UButton
          label="Add a reminder"
          icon="i-lucide-plus"
          variant="ghost"
          class="-ml-2"
        />
      </UDropdownMenu>
    </template>
  </ShellCard>
</template>
