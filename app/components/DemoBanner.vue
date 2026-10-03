<script setup lang="ts">
/**
 * Shown while the account is a demo: when it will be deleted, and the way to
 * keep it — an email, a password and a name turn it into an ordinary
 * account with the two weeks (and whatever was added since) still in it.
 */
const { user, keepDemo } = useAuth()
const toast = useToast()

const open = ref(false)
const saving = ref(false)
const form = reactive({ full_name: '', email: '', password: '' })

/** "in 3 days", "tomorrow", "today" */
const expires = computed(() => {
  const at = user.value?.demo_expires_at
  if (!at) {
    return ''
  }
  const days = Math.ceil((new Date(at).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) {
    return 'today'
  }
  return days === 1 ? 'tomorrow' : `in ${days} days`
})

const valid = computed(() =>
  form.full_name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.password.length >= 8)

async function keep() {
  if (!valid.value || saving.value) {
    return
  }
  saving.value = true
  try {
    await keepDemo({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password })
    open.value = false
    toast.add({ title: 'It\'s yours now', description: 'Sign in with that email from now on.', icon: 'i-lucide-party-popper', color: 'success' })
  } catch (error) {
    toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="user?.is_demo"
    class="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3"
    role="status"
  >
    <UIcon
      name="i-lucide-sparkles"
      class="size-5 shrink-0 text-primary"
    />
    <p class="min-w-0 flex-1 text-xs text-default">
      <span class="font-semibold">This is a demo diary.</span>
      It is deleted {{ expires }} unless you keep it.
    </p>
    <UButton
      label="Keep it"
      size="sm"
      @click="open = true"
    />

    <UDrawer
      v-model:open="open"
      :ui="SHEET_UI"
      title="Keep this diary"
      description="Give it your name, email and a password — everything in it stays."
    >
      <template #body>
        <form
          id="keep-demo"
          class="flex flex-col gap-3"
          @submit.prevent="keep"
        >
          <UFormField label="Name">
            <UInput
              v-model="form.full_name"
              autocomplete="name"
              placeholder="What should we call you?"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Email">
            <UInput
              v-model="form.email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Password"
            hint="at least 8 characters"
          >
            <UInput
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <UButton
          type="submit"
          form="keep-demo"
          label="Keep my diary"
          size="lg"
          block
          :loading="saving"
          :disabled="!valid"
        />
      </template>
    </UDrawer>
  </div>
</template>
