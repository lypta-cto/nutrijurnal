<script setup lang="ts">
import type { AuthFormField, FormError, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

useHead({ title: 'Sign in' })

const toast = useToast()
const route = useRoute()
const { login, startDemo } = useAuth()
const { providers, load: loadProviders } = useSignInProviders()

const loading = ref(false)
const serverError = ref<string | null>(null)

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    autocomplete: 'email',
    required: true
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
    placeholder: '••••••••',
    // A password manager fills the saved one in
    autocomplete: 'current-password',
    required: true
  }
]

// Landing back from Google with a reason it didn't work
const GOOGLE_ERRORS: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled or failed — try again.',
  google_no_email: 'Google returned no email for that account.',
  google_unverified: 'That Google account\'s email is not verified.',
  account_disabled: 'This account is disabled.'
}

onMounted(() => {
  void loadProviders()
  const code = route.query.error
  if (typeof code === 'string' && GOOGLE_ERRORS[code]) {
    serverError.value = GOOGLE_ERRORS[code]
  }
})

// Plain function rather than a schema library — two fields don't need one
function validate(state: Record<string, unknown>): FormError[] {
  const errors: FormError[] = []
  const email = String(state.email ?? '')
  const password = String(state.password ?? '')

  if (!email) {
    errors.push({ name: 'email', message: 'Email is required' })
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ name: 'email', message: 'Enter a valid email address' })
  }

  if (!password) {
    errors.push({ name: 'password', message: 'Password is required' })
  }

  return errors
}

// The whole app, without signing up: a demo diary with two weeks in it
const demoLoading = ref(false)

async function tryDemo() {
  demoLoading.value = true
  serverError.value = null
  try {
    await startDemo()
    toast.add({
      title: 'Welcome to the demo',
      description: 'Two weeks are already in it — add a meal, scan something, look at Progress.',
      icon: 'i-lucide-sparkles',
      color: 'success'
    })
    await navigateTo('/')
  } catch (error) {
    serverError.value = apiErrorMessage(error, 'The demo could not start. Please try again.')
  } finally {
    demoLoading.value = false
  }
}

async function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  loading.value = true
  serverError.value = null

  try {
    await login({
      email: String(event.data.email),
      password: String(event.data.password)
    })

    toast.add({ title: 'Signed in', icon: 'i-lucide-circle-check', color: 'success' })

    // Send them back to whatever the middleware interrupted
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  } catch (error) {
    serverError.value = apiErrorMessage(error, 'Could not sign in. Please try again.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <UAuthForm
      :fields="fields"
      :providers="providers"
      :validate="validate"
      :loading="loading"
      title="Welcome back"
      description="Sign in to your food diary."
      :submit="{ label: 'Sign in', size: 'lg', block: true }"
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
        New here?
        <ULink
          to="/register"
          class="text-primary font-medium"
        >
          Create an account
        </ULink>
      </template>
    </UAuthForm>

    <!-- The whole app without signing up -->
    <div class="mt-8 flex flex-col gap-3 rounded-card bg-primary/8 p-4 ring-1 ring-primary/15">
      <div class="flex items-start gap-3">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-default text-primary shadow-card">
          <UIcon
            name="i-lucide-sparkles"
            class="size-5"
          />
        </span>
        <div class="min-w-0">
          <p class="text-body font-semibold text-highlighted">
            Just looking?
          </p>
          <p class="text-sm text-muted">
            Open a diary with two weeks already in it.
          </p>
        </div>
      </div>
      <UButton
        label="Try the demo"
        color="neutral"
        variant="outline"
        size="lg"
        block
        :loading="demoLoading"
        :disabled="loading"
        @click="tryDemo"
      />
      <p class="text-center text-caption text-muted">
        No email needed. Deleted after a few days unless you keep it.
      </p>
    </div>
  </div>
</template>
