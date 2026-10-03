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
    eyebrow="Account and preferences"
  >
    <DemoBanner />

    <UAlert
      v-if="settingsFailed"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      title="Your settings didn't load"
      description="The targets and water goal below are blank until they do — nothing has been changed."
      :actions="[{ label: 'Try again', icon: 'i-lucide-refresh-cw', color: 'warning', variant: 'outline', loading: retryingSettings, onClick: () => void retrySettings() }]"
    />

    <!-- Profile -->
    <ShellCard flush>
      <div class="px-4 py-4">
        <AvatarUpload>
          <span class="truncate text-headline font-semibold text-highlighted">{{ displayName }}</span>
          <span class="truncate text-sm text-muted">{{ user?.email }}</span>
        </AvatarUpload>
      </div>
      <form
        class="flex items-end gap-2 px-4 py-4"
        @submit.prevent="profileChanged && saveProfile()"
      >
        <UFormField
          label="Name"
          class="min-w-0 flex-1"
        >
          <UInput
            v-model="profile.full_name"
            placeholder="Your name"
            autocomplete="name"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          label="Save"
          variant="soft"
          :loading="savingProfile"
          :disabled="!profileChanged"
        />
      </form>
    </ShellCard>

    <!-- Daily targets -->
    <ShellSection
      title="Daily targets"
      description="What a day should come to. Leave one empty and the diary simply counts it."
      class="mt-3"
    >
      <ShellCard>
        <div class="flex flex-col gap-4 pt-2">
          <TargetsFields v-model="targets" />
          <div class="flex items-center gap-2 border-t border-default pt-4">
            <UButton
              :label="settings?.profile ? 'Recalculate' : 'Work them out'"
              icon="i-lucide-calculator"
              color="neutral"
              variant="soft"
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
        </div>
      </ShellCard>
    </ShellSection>

    <!-- Water -->
    <ShellSection
      title="Water"
      description="A daily goal, and the glass one tap of “+” adds."
      class="mt-3"
    >
      <ShellCard>
        <form
          class="flex flex-col gap-4 pt-2"
          @submit.prevent="waterChanged && storeWater()"
        >
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
                  <span class="text-sm text-dimmed">ml</span>
                </template>
              </UInput>
            </UFormField>
            <UFormField label="One glass">
              <UInput
                v-model.number="water.glass"
                type="number"
                inputmode="numeric"
                step="10"
                class="w-full"
                :ui="{ base: 'tabular-nums', trailing: 'pointer-events-none' }"
              >
                <template #trailing>
                  <span class="text-sm text-dimmed">ml</span>
                </template>
              </UInput>
            </UFormField>
          </div>
          <UButton
            type="submit"
            label="Save water goal"
            class="self-end"
            :loading="savingWater"
            :disabled="!waterChanged"
          />
        </form>
      </ShellCard>
    </ShellSection>

    <ShellSection
      title="Reminders"
      description="A nudge at meal times, for water, and a summary of the day."
      class="mt-3"
    >
      <ReminderSettings />
    </ShellSection>

    <InstallPrompt
      variant="settings"
      class="mt-3"
    />

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
    <ShellSection
      title="Appearance"
      class="mt-3"
    >
      <ShellCard flush>
        <div class="flex flex-col gap-3 px-4 py-3.5">
          <span class="flex items-center gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-toned">
              <UIcon
                name="i-lucide-palette"
                class="size-5"
              />
            </span>
            <span class="flex min-w-0 flex-col">
              <span class="text-body font-semibold text-highlighted">Theme</span>
              <span class="text-xs text-muted">Follow the phone, or pick one.</span>
            </span>
          </span>
          <ShellSegmented
            v-model="theme"
            label="Theme"
            :options="MODES"
          />
        </div>
      </ShellCard>
    </ShellSection>

    <!-- Your data -->
    <ShellSection
      title="Your data"
      class="mt-3"
    >
      <ShellCard flush>
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
      </ShellCard>
    </ShellSection>

    <ExportSheet
      v-model:open="exportOpen"
      :day="today"
    />

    <!-- Account -->
    <ShellSection
      title="Account"
      class="mt-3"
    >
      <ShellCard flush>
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
                class="size-4 text-dimmed transition-transform duration-200 ease-soft motion-reduce:transition-none"
                :class="passwordOpen && 'rotate-180'"
              />
            </template>
          </ShellListRow>
          <form
            v-if="passwordOpen"
            class="flex flex-col gap-3 bg-elevated/40 px-4 py-4"
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
      </ShellCard>
    </ShellSection>

    <p class="pt-3 text-center text-caption text-dimmed">
      {{ app.name }} · {{ app.tagline }}
    </p>
  </AppPage>
</template>
