<script setup lang="ts">
import type { Targets } from '~/composables/useEating'
import { targetsOf } from '~/composables/useEating'

/**
 * The first-run questions: what a day should come to. Answered or skipped,
 * it is asked once — the account is marked onboarded either way, and the
 * targets can be changed any time from Settings.
 */
definePageMeta({ layout: 'auth' })

useHead({ title: 'Your daily targets' })

const toast = useToast()
const { user } = useAuth()
const { settings, loadSettings, saveSettings } = useEating()

const targets = ref<Targets>(targetsOf(null))
const saving = ref(false)

onMounted(async () => {
  await loadSettings().catch(() => {})
  targets.value = targetsOf(settings.value)
})

async function finish(withTargets: boolean) {
  if (saving.value) {
    return
  }
  saving.value = true
  try {
    const saved = await saveSettings(withTargets ? { ...targets.value, onboarded: true } : { onboarded: true })
    // The middleware reads this off the session; no need to fetch /auth/me again
    if (user.value) {
      user.value = { ...user.value, onboarded_at: saved.onboarded_at }
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
        What should a day come to?
      </h1>
      <p class="mt-1 text-sm text-muted">
        Your daily targets turn the diary's numbers into a score. Not sure yet?
        Set just the kcal, split it into macros, or skip and decide later.
      </p>
    </div>

    <TargetsFields v-model="targets" />

    <div class="flex flex-col gap-2">
      <UButton
        label="Save and start"
        size="lg"
        block
        :loading="saving"
        @click="finish(true)"
      />
      <UButton
        label="Skip for now"
        color="neutral"
        variant="ghost"
        block
        :disabled="saving"
        @click="finish(false)"
      />
    </div>
  </div>
</template>
