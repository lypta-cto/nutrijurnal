<script setup lang="ts">
import type { GoalProfile, Targets } from '~/composables/useEating'
import { targetsOf } from '~/composables/useEating'

/**
 * The first-run questions: a short goal calculator that ends in the day's
 * targets. Answered, typed by hand or skipped, it is asked once — the
 * account is marked onboarded either way, and the same calculator waits in
 * Settings.
 */
definePageMeta({ layout: 'auth' })

useHead({ title: 'Your daily targets' })

const toast = useToast()
const { user } = useAuth()
const { settings, loadSettings, saveSettings } = useEating()
const { putWeight } = useBody()

/** The calculator, or the four numbers typed straight in */
const mode = ref<'calculator' | 'manual'>('calculator')
const targets = ref<Targets>(targetsOf(null))
const saving = ref(false)
const loaded = ref(false)

onMounted(async () => {
  await loadSettings().catch(() => {})
  targets.value = targetsOf(settings.value)
  loaded.value = true
})

async function finish(patch: { targets?: Targets, profile?: GoalProfile }) {
  if (saving.value) {
    return
  }
  saving.value = true
  try {
    const saved = await saveSettings({ ...patch.targets, profile: patch.profile, onboarded: true })
    // The weight the calculator was given is the first point of the trend
    if (patch.profile) {
      await putWeight(localIsoDay(), patch.profile.weight_kg).catch(() => {})
    }
    // The middleware reads this off the session; no need to fetch /auth/me again
    if (user.value) {
      user.value = { ...user.value, onboarded_at: saved.onboarded_at }
    }
    if (patch.targets?.target_kcal) {
      toast.add({ title: 'Targets saved — welcome in', icon: 'i-lucide-target', color: 'success' })
    }
    await navigateTo('/', { replace: true })
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold text-highlighted">
        Let's set your day
      </h1>
      <p class="mt-1 text-sm text-muted">
        A few questions give you a daily kcal and macro target, so every meal you log has
        something to count towards.
      </p>
    </div>

    <template v-if="loaded">
      <GoalWizard
        v-if="mode === 'calculator'"
        :initial="settings?.profile ?? null"
        finish-label="Save and start"
        :saving="saving"
        @finish="finish"
      />

      <div
        v-else
        class="flex flex-col gap-4"
      >
        <TargetsFields v-model="targets" />
        <UButton
          label="Save and start"
          size="lg"
          block
          :loading="saving"
          @click="finish({ targets })"
        />
      </div>
    </template>
    <USkeleton
      v-else
      class="h-64 w-full"
    />

    <div class="flex flex-col items-center gap-1">
      <UButton
        :label="mode === 'calculator' ? 'I know my numbers' : 'Work them out for me'"
        :icon="mode === 'calculator' ? 'i-lucide-pencil-line' : 'i-lucide-calculator'"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="saving"
        @click="mode = mode === 'calculator' ? 'manual' : 'calculator'"
      />
      <UButton
        label="Skip for now"
        color="neutral"
        variant="link"
        size="sm"
        :disabled="saving"
        @click="finish({})"
      />
    </div>
  </div>
</template>
