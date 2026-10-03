<script setup lang="ts">
import type { GoalProfile, Targets } from '~/composables/useEating'
import { targetsOf } from '~/composables/useEating'

const colorMode = useColorMode()
const toast = useToast()
const api = useApi()
const { confirm } = useConfirm()

const { user, logout, deleteAccount } = useAuth()
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

onMounted(async () => {
  await loadSettings().catch(() => {})
  targets.value = targetsOf(settings.value)
})

const targetsChanged = computed(() =>
  JSON.stringify(targets.value) !== JSON.stringify(targetsOf(settings.value)))

async function storeTargets() {
  savingTargets.value = true
  try {
    await saveSettings({ ...targets.value })
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

/* --- Your data ------------------------------------------------------------ */

const exportOpen = ref(false)
const withRecordings = ref(false)
const exportingAll = ref(false)

/** Everything in one JSON file, saved straight to the device */
async function exportEverything() {
  exportingAll.value = true
  try {
    const document = await api.get<object>('/auth/me/export', { query: { recordings: withRecordings.value || undefined } })
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }))
    const link = window.document.createElement('a')
    link.href = url
    link.download = `Nutrijurnal_export_${localIsoDay()}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    toast.add({ title: 'Your data is downloading', icon: 'i-lucide-download', color: 'success' })
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
  <AppPage title="Settings">
    <DemoBanner />

    <!-- Profile -->
    <section class="app-card px-4">
      <h2 class="flex items-center gap-2 pt-4 font-semibold text-highlighted">
        <UIcon
          name="i-lucide-user"
          class="size-4 text-muted"
        />
        Profile
      </h2>

      <SettingsRow title="Photo">
        <AvatarUpload />
      </SettingsRow>

      <SettingsRow title="Name">
        <div class="flex w-full items-start gap-2">
          <UInput
            v-model="profile.full_name"
            placeholder="Your name"
            class="flex-1"
            @keyup.enter="profileChanged && saveProfile()"
          />
          <UButton
            label="Save"
            :loading="savingProfile"
            :disabled="!profileChanged"
            @click="saveProfile"
          />
        </div>
      </SettingsRow>

      <SettingsRow
        title="Email"
        description="Used to sign in."
      >
        <UInput
          :model-value="user?.email"
          disabled
          class="w-full"
        />
      </SettingsRow>
    </section>

    <!-- Daily targets -->
    <section class="app-card flex flex-col gap-3 px-4 py-4">
      <div>
        <h2 class="flex items-center gap-2 font-semibold text-highlighted">
          <UIcon
            name="i-lucide-target"
            class="size-4 text-muted"
          />
          Daily targets
        </h2>
        <p class="mt-0.5 text-sm text-muted">
          What a day should come to. Leave one empty and the diary simply counts it.
        </p>
      </div>
      <TargetsFields v-model="targets" />
      <div class="flex items-center gap-2">
        <UButton
          :label="settings?.profile ? 'Recalculate' : 'Work them out for me'"
          icon="i-lucide-calculator"
          color="neutral"
          variant="subtle"
          @click="calculatorOpen = true"
        />
        <UButton
          label="Save targets"
          class="ml-auto"
          :loading="savingTargets"
          :disabled="!targetsChanged"
          @click="storeTargets"
        />
      </div>
    </section>

    <!-- Water -->
    <section class="app-card flex flex-col gap-3 px-4 py-4">
      <div>
        <h2 class="flex items-center gap-2 font-semibold text-highlighted">
          <UIcon
            name="i-lucide-glass-water"
            class="size-4 text-muted"
          />
          Water
        </h2>
        <p class="mt-0.5 text-sm text-muted">
          A daily goal, and the glass one tap of “+” adds.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Daily goal">
          <UInput
            v-model.number="water.goal"
            type="number"
            inputmode="numeric"
            step="50"
            class="w-full"
            :ui="{ base: 'tabular-nums', trailing: 'pointer-events-none' }"
          >
            <template #trailing>
              <span class="text-xs text-dimmed">ml</span>
            </template>
          </UInput>
        </UFormField>
        <UFormField label="Glass">
          <UInput
            v-model.number="water.glass"
            type="number"
            inputmode="numeric"
            step="10"
            class="w-full"
            :ui="{ base: 'tabular-nums', trailing: 'pointer-events-none' }"
          >
            <template #trailing>
              <span class="text-xs text-dimmed">ml</span>
            </template>
          </UInput>
        </UFormField>
      </div>
      <UButton
        label="Save water goal"
        class="self-end"
        :loading="savingWater"
        :disabled="!waterChanged"
        @click="storeWater"
      />
    </section>

    <ReminderSettings />

    <InstallPrompt variant="settings" />

    <UDrawer
      v-model:open="calculatorOpen"
      title="Goal calculator"
      description="Your body, your week, your goal — and the day it comes to."
      :ui="{ ...SHEET_UI, body: 'overflow-y-auto app-safe-bottom' }"
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
    <section class="app-card px-4">
      <h2 class="flex items-center gap-2 pt-4 font-semibold text-highlighted">
        <UIcon
          name="i-lucide-palette"
          class="size-4 text-muted"
        />
        Appearance
      </h2>

      <SettingsRow
        title="Theme"
        description="Follow the phone, or pick one."
      >
        <div class="grid w-full grid-cols-3 gap-1 rounded-xl bg-elevated p-1">
          <UButton
            v-for="mode in MODES"
            :key="mode.value"
            :icon="mode.icon"
            :label="mode.label"
            size="sm"
            class="justify-center rounded-lg"
            :color="colorMode.preference === mode.value ? 'primary' : 'neutral'"
            :variant="colorMode.preference === mode.value ? 'solid' : 'ghost'"
            :aria-pressed="colorMode.preference === mode.value"
            @click="colorMode.preference = mode.value"
          />
        </div>
      </SettingsRow>
    </section>

    <!-- Your data -->
    <section class="app-card px-4">
      <h2 class="flex items-center gap-2 pt-4 font-semibold text-highlighted">
        <UIcon
          name="i-lucide-hard-drive-download"
          class="size-4 text-muted"
        />
        Your data
      </h2>

      <SettingsRow
        title="The diary"
        description="A period day by day — a PDF to print, or a CSV for a spreadsheet."
      >
        <UButton
          label="Export the diary…"
          icon="i-lucide-file-down"
          color="neutral"
          variant="outline"
          @click="exportOpen = true"
        />
      </SettingsRow>

      <SettingsRow
        title="Everything"
        description="Meals, foods, recipes, water, weight, targets and reminders in one JSON file."
      >
        <div class="flex w-full flex-col items-start gap-2">
          <USwitch
            v-model="withRecordings"
            label="Include voice recordings"
            description="Makes the file much larger"
          />
          <UButton
            label="Export all my data"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :loading="exportingAll"
            @click="exportEverything"
          />
        </div>
      </SettingsRow>
    </section>

    <ExportSheet
      v-model:open="exportOpen"
      :day="localIsoDay()"
    />

    <!-- Account -->
    <section class="app-card px-4">
      <h2 class="flex items-center gap-2 pt-4 font-semibold text-highlighted">
        <UIcon
          name="i-lucide-shield"
          class="size-4 text-muted"
        />
        Account
      </h2>

      <SettingsRow
        v-if="user?.has_password"
        title="Password"
        description="Changing it signs you out everywhere."
      >
        <form
          class="flex w-full flex-col gap-2"
          @submit.prevent="changePassword"
        >
          <UInput
            v-model="password.current"
            type="password"
            autocomplete="current-password"
            placeholder="Current password"
            class="w-full"
          />
          <UInput
            v-model="password.next"
            type="password"
            autocomplete="new-password"
            placeholder="New password — at least 8 characters"
            class="w-full"
          />
          <UButton
            type="submit"
            label="Change password"
            color="neutral"
            variant="outline"
            class="self-end"
            :loading="savingPassword"
            :disabled="!password.current || !password.next"
          />
        </form>
      </SettingsRow>

      <SettingsRow title="Sign out">
        <UButton
          label="Sign out"
          icon="i-lucide-log-out"
          color="neutral"
          variant="outline"
          @click="logout"
        />
      </SettingsRow>

      <SettingsRow
        title="Delete account"
        description="Removes your diary, foods, recipes, water, weight and reminders for good. Export your data first if you want a copy."
      >
        <UButton
          label="Delete account"
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          @click="confirmDelete"
        />
      </SettingsRow>
    </section>
  </AppPage>
</template>
