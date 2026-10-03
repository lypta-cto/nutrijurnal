<script setup lang="ts">
import type { GoalProfile, Targets } from '~/composables/useEating'
import { changedTargets, targetsOf } from '~/composables/useEating'

const { app } = useAppConfig()
const colorMode = useColorMode()
const toast = useToast()
const api = useApi()
const { confirm } = useConfirm()

const { user, displayName, logout, deleteAccount } = useAuth()
const today = useToday()
const { settings, loadSettings, saveSettings } = useEating()
const { putWeight } = useBody()

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

/* --- Profile ------------------------------------------------------------- */

const profile = reactive({ full_name: user.value?.full_name ?? '' })
const savingProfile = ref(false)

const profileChanged = computed(
  () => profile.full_name.trim() !== (user.value?.full_name ?? '')
)

async function saveProfile() {
  savingProfile.value = true
  try {
    user.value = await api.patch('/auth/me', { full_name: profile.full_name.trim() || null })
    toast.add({ title: 'Profile updated', icon: 'i-lucide-circle-check', color: 'success' })
  } catch (error) {
    fail(error)
  } finally {
    savingProfile.value = false
  }
}

/* --- Daily targets ------------------------------------------------------- */

const targets = ref<Targets>(targetsOf(settings.value))
const savingTargets = ref(false)
/** The settings could not be read: the fields below are blank, not the account's */
const settingsFailed = ref(false)
const retryingSettings = ref(false)

async function readSettings() {
  try {
    await loadSettings()
    settingsFailed.value = false
  } catch {
    settingsFailed.value = true
  }
  targets.value = targetsOf(settings.value)
}

onMounted(() => void readSettings())

async function retrySettings() {
  retryingSettings.value = true
  try {
    await readSettings()
  } finally {
    retryingSettings.value = false
  }
}

const targetsChanged = computed(() =>
  Object.keys(changedTargets(targets.value, targetsOf(settings.value))).length > 0)

async function storeTargets() {
  savingTargets.value = true
  try {
    await saveSettings(changedTargets(targets.value, targetsOf(settings.value)))
    targets.value = targetsOf(settings.value)
    toast.add({ title: 'Targets saved', icon: 'i-lucide-target', color: 'success' })
  } catch (error) {
    fail(error)
  } finally {
    savingTargets.value = false
  }
}

/* --- Water --------------------------------------------------------------- */

const water = reactive({ goal: undefined as number | undefined, glass: undefined as number | undefined })
const savingWater = ref(false)

watch(settings, (value) => {
  water.goal = value?.water_goal_ml
  water.glass = value?.water_glass_ml
}, { immediate: true })

const waterChanged = computed(() =>
  water.goal !== settings.value?.water_goal_ml || water.glass !== settings.value?.water_glass_ml)

async function storeWater() {
  const goal = Number(water.goal)
  const glass = Number(water.glass)
  if (!(goal >= 250 && goal <= 10000) || !(glass >= 50 && glass <= 2000)) {
    toast.add({ title: 'A goal of 250–10 000 ml and a glass of 50–2 000 ml', icon: 'i-lucide-circle-help', color: 'warning' })
    return
  }
  savingWater.value = true
  try {
    await saveSettings({ water_goal_ml: goal, water_glass_ml: glass })
    toast.add({ title: 'Water goal saved', icon: 'i-lucide-glass-water', color: 'success' })
  } catch (error) {
    fail(error)
  } finally {
    savingWater.value = false
  }
}

/* --- The goal calculator ------------------------------------------------- */

const calculatorOpen = ref(false)
useSheetHistory(calculatorOpen)
const savingCalculated = ref(false)

async function storeCalculated(result: { profile: GoalProfile, targets: Targets }) {
  savingCalculated.value = true
  try {
    const before = settings.value?.profile?.weight_kg
    await saveSettings({ ...result.targets, profile: result.profile })
    // A new weight typed into the calculator is a weighing too
    if (result.profile.weight_kg !== before) {
      await putWeight(localIsoDay(), result.profile.weight_kg).catch(() => {})
    }
    targets.value = targetsOf(settings.value)
    calculatorOpen.value = false
    toast.add({ title: 'New targets saved', icon: 'i-lucide-target', color: 'success' })
  } catch (error) {
    fail(error)
  } finally {
    savingCalculated.value = false
  }
}

/* --- Password ------------------------------------------------------------ */

const password = reactive({ current: '', next: '' })
const savingPassword = ref(false)
/** The form opens from its row — two password fields are a lot to show by default */
const passwordOpen = ref(false)

async function changePassword() {
  if (password.next.length < 8) {
    toast.add({ title: 'The new password needs at least 8 characters', icon: 'i-lucide-circle-alert', color: 'error' })
    return
  }
  savingPassword.value = true
  try {
    await api.post('/auth/me/password', { current_password: password.current, new_password: password.next })
    toast.add({ title: 'Password changed — sign in again', icon: 'i-lucide-circle-check', color: 'success' })
    // The API ended every session, this one included
    await logout()
  } catch (error) {
    fail(error)
  } finally {
    savingPassword.value = false
  }
}

/* --- Appearance ---------------------------------------------------------- */

const MODES = [
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' }
]

const theme = computed({
  get: () => colorMode.preference,
  set: (value: string) => {
    colorMode.preference = value
  }
})

/* --- Your data ------------------------------------------------------------ */

const exportOpen = ref(false)
const withRecordings = ref(false)
const exportingAll = ref(false)
const saveFile = useSaveFile()

/** Everything in one JSON file, saved straight to the device */
async function exportEverything() {
  exportingAll.value = true
  try {
    const document = await api.get<object>('/auth/me/export', { query: { recordings: withRecordings.value || undefined } })
    const file = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
    if (await saveFile(file, `Nutrijurnal_export_${localIsoDay()}.json`) === 'downloaded') {
      toast.add({ title: 'Your data is downloading', icon: 'i-lucide-download', color: 'success' })
    }
  } catch (error) {
    fail(error)
  } finally {
    exportingAll.value = false
  }
}

/* --- Leaving ------------------------------------------------------------- */

async function confirmDelete() {
  const sure = await confirm({
    title: 'Delete your account?',
    description: 'Your diary, recipes, foods, voice notes, water, weight and reminders are deleted for good. This cannot be undone.',
    confirmLabel: 'Delete everything',
    color: 'error'
  })
  if (!sure) {
    return
  }
  try {
    await deleteAccount()
    toast.add({ title: 'Account deleted', icon: 'i-lucide-circle-check', color: 'success' })
  } catch (error) {
    fail(error)
  }
}
</script>

<template>
  <AppPage
    title="Settings"
    eyebrow=""
  >
    <DemoBanner />

    <ShellCard v-if="settingsFailed">
      <ShellEmpty
        compact
        icon="i-lucide-wifi-off"
        title="Your settings didn't load"
        description="The targets and water goal below are blank until they do — nothing has been changed."
        class="-mx-4 -my-4"
      >
        <UButton
          label="Try again"
          size="sm"
          variant="soft"
          :loading="retryingSettings"
          @click="retrySettings"
        />
      </ShellEmpty>
    </ShellCard>

    <!-- Who this is, and the name the diary uses — the first group, as in iOS Settings -->
    <ShellList>
      <div class="px-4 py-3">
        <AvatarUpload>
          <span class="truncate text-title3 text-highlighted">{{ displayName }}</span>
          <span class="truncate text-subheadline text-muted">{{ user?.email }}</span>
        </AvatarUpload>
      </div>
      <form
        class="flex items-center"
        @submit.prevent="profileChanged && saveProfile()"
      >
        <ShellFieldRow
          label="Name"
          wide
          class="min-w-0 flex-1"
        >
          <UInput
            v-model="profile.full_name"
            placeholder="Your name"
            autocomplete="name"
            variant="none"
            :ui="FIELD_ROW_INPUT"
          />
        </ShellFieldRow>
        <UButton
          v-if="profileChanged || savingProfile"
          type="submit"
          label="Save"
          variant="ghost"
          size="sm"
          class="mr-2 shrink-0"
          :loading="savingProfile"
        />
      </form>
    </ShellList>

    <!-- Daily targets: the four numbers, the calculator, and Save -->
    <ShellSection title="Daily targets">
      <TargetsFields v-model="targets">
        <ShellListRow
          icon="i-lucide-calculator"
          tone="neutral"
          :title="settings?.profile ? 'Recalculate' : 'Work them out'"
          @click="calculatorOpen = true"
        />
      </TargetsFields>
      <p class="-mt-1.5 px-4 text-footnote text-pretty text-muted">
        What a day should come to. Leave one empty and the diary simply counts it.
      </p>
      <!-- Only there when there is something to save, as in iOS Settings -->
      <UButton
        v-if="targetsChanged || savingTargets"
        label="Save targets"
        class="self-end"
        :loading="savingTargets"
        @click="storeTargets"
      />
    </ShellSection>

    <!-- Water -->
    <ShellSection title="Water">
      <form
        class="flex flex-col gap-3"
        @submit.prevent="waterChanged && storeWater()"
      >
        <div class="app-card app-divide flex flex-col overflow-hidden">
          <ShellFieldRow
            label="Daily goal"
            unit="ml"
          >
            <UInput
              v-model.number="water.goal"
              type="number"
              inputmode="numeric"
              step="50"
              variant="none"
              :ui="FIELD_ROW_INPUT"
            />
          </ShellFieldRow>
          <ShellFieldRow
            label="One glass"
            unit="ml"
          >
            <UInput
              v-model.number="water.glass"
              type="number"
              inputmode="numeric"
              step="10"
              variant="none"
              :ui="FIELD_ROW_INPUT"
            />
          </ShellFieldRow>
        </div>
        <p class="-mt-1.5 px-4 text-footnote text-pretty text-muted">
          A daily goal, and the glass one tap of “+” adds.
        </p>
        <UButton
          v-if="waterChanged || savingWater"
          type="submit"
          label="Save water goal"
          class="self-end"
          :loading="savingWater"
        />
      </form>
    </ShellSection>

    <ShellSection
      title="Reminders"
      description="A nudge at meal times, for water, and a summary of the day."
    >
      <ReminderSettings />
    </ShellSection>

    <InstallPrompt variant="settings" />

    <UDrawer
      v-model:open="calculatorOpen"
      title="Goal calculator"
      description="Your body, your week, your goal — and the day it comes to."
      :ui="{ ...SHEET_UI, body: 'pb-[max(1.25rem,env(safe-area-inset-bottom))]' }"
    >
      <template #body>
        <GoalWizard
          v-if="calculatorOpen"
          :initial="settings?.profile ?? null"
          :saving="savingCalculated"
          @finish="storeCalculated"
        />
      </template>
    </UDrawer>

    <!-- Appearance -->
    <ShellList
      title="Appearance"
      description="Follow the phone, or pick one."
    >
      <div class="px-4 py-3">
        <ShellSegmented
          v-model="theme"
          label="Theme"
          :options="MODES"
        />
      </div>
    </ShellList>

    <!-- Your data -->
    <ShellList title="Your data">
      <ShellListRow
        icon="i-lucide-file-down"
        tone="neutral"
        title="Export the diary"
        subtitle="A period day by day — a PDF to print, or a CSV for a spreadsheet."
        @click="exportOpen = true"
      />
      <ShellListRow
        icon="i-lucide-hard-drive-download"
        tone="neutral"
        title="Download everything"
        subtitle="Meals, foods, recipes, water, weight, targets and reminders in one JSON file."
        :chevron="false"
        :disabled="exportingAll"
        @click="exportEverything"
      >
        <template #trailing>
          <UIcon
            :name="exportingAll ? 'i-lucide-loader-circle' : 'i-lucide-download'"
            class="size-5 text-muted"
            :class="exportingAll && 'animate-spin'"
          />
        </template>
      </ShellListRow>
      <ShellListRow
        plain
        icon="i-lucide-audio-lines"
        tone="neutral"
        title="Include voice recordings"
        subtitle="In the download — makes the file much larger."
      >
        <template #trailing>
          <USwitch
            v-model="withRecordings"
            aria-label="Include voice recordings in the download"
          />
        </template>
      </ShellListRow>
    </ShellList>

    <ExportSheet
      v-model:open="exportOpen"
      :day="today"
    />

    <!-- Account -->
    <ShellList title="Account">
      <template v-if="user?.has_password">
        <ShellListRow
          icon="i-lucide-key-round"
          tone="neutral"
          title="Change password"
          subtitle="Changing it signs you out everywhere."
          :chevron="false"
          :aria-expanded="passwordOpen"
          @click="passwordOpen = !passwordOpen"
        >
          <template #trailing>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4.5 text-dimmed transition-transform duration-200 ease-soft motion-reduce:transition-none"
              :class="passwordOpen && 'rotate-180'"
            />
          </template>
        </ShellListRow>
        <form
          v-if="passwordOpen"
          class="flex flex-col gap-3 px-4 py-3"
          :style="{ '--app-divide-inset': '3.25rem' }"
          @submit.prevent="changePassword"
        >
          <UInput
            v-model="password.current"
            type="password"
            autocomplete="current-password"
            placeholder="Current password"
            aria-label="Current password"
            class="w-full"
          />
          <UInput
            v-model="password.next"
            type="password"
            autocomplete="new-password"
            placeholder="New password — at least 8 characters"
            aria-label="New password"
            class="w-full"
          />
          <UButton
            type="submit"
            label="Change password"
            class="self-end"
            :loading="savingPassword"
            :disabled="!password.current || !password.next"
          />
        </form>
      </template>

      <ShellListRow
        icon="i-lucide-log-out"
        tone="neutral"
        title="Sign out"
        :chevron="false"
        @click="logout"
      />

      <ShellListRow
        icon="i-lucide-trash-2"
        tone="error"
        title="Delete account"
        subtitle="Everything in it, for good — export first if you want a copy."
        :chevron="false"
        @click="confirmDelete"
      />
    </ShellList>

    <p class="pt-2 pb-2 text-center text-footnote text-dimmed">
      {{ app.name }} · {{ app.tagline }}
    </p>
  </AppPage>
</template>
