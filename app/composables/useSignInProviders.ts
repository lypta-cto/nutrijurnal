import type { ButtonProps } from '@nuxt/ui'

interface Providers {
  password: boolean
  google: boolean
}

/**
 * The ways in this installation offers. Google sign-in only exists when the
 * API has a client id, so the button is drawn only once the API says so —
 * never a button that answers 501.
 */
export function useSignInProviders() {
  const { apiBase } = useRuntimeConfig().public
  const api = useApi()
  const known = useState<Providers | null>('sign-in-providers', () => null)

  async function load() {
    if (known.value) {
      return known.value
    }
    try {
      known.value = await api.get<Providers>('/auth/providers')
    } catch {
      // No answer means no extra buttons; email and password still work
      known.value = null
    }
    return known.value
  }

  // A plain link, not fetch() — the OAuth dance needs real browser navigation
  const providers = computed<ButtonProps[]>(() => known.value?.google
    ? [{
        label: 'Continue with Google',
        icon: 'i-simple-icons-google',
        color: 'neutral',
        variant: 'outline',
        href: `${apiBase}/auth/google/authorize`,
        external: true
      }]
    : [])

  return { providers, load }
}
