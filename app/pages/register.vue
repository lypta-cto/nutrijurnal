<script setup lang="ts">
import type { AuthFormField, FormError, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

useHead({ title: 'Create account' })

const toast = useToast()
const { register } = useAuth()
const { providers, load: loadProviders } = useSignInProviders()

onMounted(() => {
  void loadProviders()
})

const loading = ref(false)
const serverError = ref<string | null>(null)

const fields: AuthFormField[] = [
  {
    name: 'full_name',
    type: 'text',
    label: 'Name',
    placeholder: 'What should we call you?',
    required: true
  },
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    required: true
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
    placeholder: 'At least 8 characters',
    required: true
  }
]

function validate(state: Record<string, unknown>): FormError[] {
  const errors: FormError[] = []
  const name = String(state.full_name ?? '').trim()
  const email = String(state.email ?? '')
  const password = String(state.password ?? '')

  if (!name) {
    errors.push({ name: 'full_name', message: 'Your name is required' })
  }

  if (!email) {
    errors.push({ name: 'email', message: 'Email is required' })
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ name: 'email', message: 'Enter a valid email address' })
  }

  // Matches the backend's minimum, so the request isn't wasted
  if (password.length < 8) {
    errors.push({ name: 'password', message: 'Must be at least 8 characters' })
  }

  return errors
}

async function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  loading.value = true
  serverError.value = null

  try {
    await register({
      email: String(event.data.email),
      password: String(event.data.password),
      full_name: String(event.data.full_name).trim()
    })

    toast.add({ title: 'Welcome to Nutrijurnal', icon: 'i-lucide-circle-check', color: 'success' })

    // A new account has targets to set before the diary opens
    await navigateTo('/onboarding')
  } catch (error) {
    serverError.value = apiErrorMessage(error, 'Could not create the account.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UAuthForm
    :fields="fields"
    :providers="providers"
    :validate="validate"
    :loading="loading"
    title="Start your food diary"
    description="You're signed in straight away."
    :submit="{ label: 'Create account', size: 'lg', block: true }"
    :ui="{ title: 'text-2xl', description: 'text-sm' }"
    @submit="onSubmit"
  >
    <template #validation>
      <UAlert
        v-if="serverError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="serverError"
      />
    </template>

    <template #footer>
      Already have an account?
      <ULink
        to="/login"
        class="text-primary font-medium"
      >
        Sign in
      </ULink>
    </template>
  </UAuthForm>
</template>
