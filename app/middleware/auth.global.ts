/** Routes reachable without a session */
const PUBLIC_ROUTES = ['/login', '/register']

/** Where Google sign-in lands, with a fresh refresh cookie already set */
const CALLBACK_ROUTE = '/auth/callback'

const ONBOARDING_ROUTE = '/onboarding'

export default defineNuxtRouteMiddleware(async (to) => {
  const { restore, isAuthenticated, user } = useAuth()

  // Turns the httpOnly cookie back into a session. Runs once — `restore`
  // short-circuits after the first attempt has settled.
  await restore()

  // Back from Google: the cookie it set has just been traded above
  if (to.path === CALLBACK_ROUTE) {
    return navigateTo(isAuthenticated.value ? '/' : '/login?error=google_denied', { replace: true })
  }

  if (PUBLIC_ROUTES.includes(to.path)) {
    return isAuthenticated.value ? navigateTo('/') : undefined
  }

  if (!isAuthenticated.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  // A new account answers the first-run questions (or skips them) before the
  // diary opens, so the first day it sees is measured against something
  const onboarded = Boolean(user.value?.onboarded_at)
  if (!onboarded && to.path !== ONBOARDING_ROUTE) {
    return navigateTo(ONBOARDING_ROUTE)
  }
})
