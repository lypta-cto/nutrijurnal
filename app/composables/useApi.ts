import type { FetchResponse } from 'ofetch'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface ApiOptions {
  method?: HttpMethod
  /** Objects are sent as JSON; FormData passes through so uploads keep their boundary */
  body?: Record<string, unknown> | FormData | undefined
  query?: Record<string, unknown>
  headers?: Record<string, string>
}

/**
 * Thin wrapper around $fetch for the backend API.
 *
 * - Sends the in-memory access token as a Bearer header
 * - `credentials: 'include'` so the httpOnly refresh cookie travels
 * - On a 401 it refreshes once, then replays the request
 *
 * The retry is deliberately once-only: if refreshing also fails the session is
 * genuinely gone, and looping would hammer the API.
 */
// Where a 401 means the credentials sent were wrong, not that a session ran
// out — refreshing would only hide "Incorrect email or password"
const EXCHANGES = /\/auth\/(?:refresh|login|register|demo)$/

/** Pages that need no session — a 401 met there is not a session ending */
const OPEN_PAGES = ['/login', '/register', '/auth/callback']

export function useApi() {
  const { apiBase } = useRuntimeConfig().public
  const { accessToken, refresh, clearSession } = useAuthState()
  // Taken now, while the component that asked is being set up: the 401 below
  // arrives later, outside any setup, where the router can't be looked up
  const router = useRouter()

  /**
   * Same call as `request`, but hands back the whole response — use it when the
   * headers carry something (a download's `Content-Disposition` filename).
   */
  async function raw<T>(path: string, options: ApiOptions = {}): Promise<FetchResponse<T>> {
    const send = () =>
      $fetch.raw<T>(path, {
        baseURL: apiBase,
        credentials: 'include',
        method: options.method,
        body: options.body,
        query: options.query,
        headers: {
          ...options.headers,
          ...(accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {})
        }
      })

    try {
      return await send()
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status

      // Never refresh in response to a failing refresh — that's how you loop
      if (status !== 401 || EXCHANGES.test(path)) {
        throw error
      }

      if (!(await refresh())) {
        clearSession()
        // The session is over (expired, revoked, a demo that was deleted):
        // every further tap would fail the same way, so sign in again here
        const here = router.currentRoute.value
        if (!OPEN_PAGES.includes(here.path)) {
          void router.replace({ path: '/login', query: { redirect: here.fullPath } })
        }
        throw error
      }

      return await send()
    }
  }

  /** `$fetch` is `(await $fetch.raw(…))._data` — this keeps that shape */
  async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    return (await raw<T>(path, options))._data as T
  }

  return {
    raw,
    request,
    get: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: ApiOptions['body'], options?: ApiOptions) =>
      request<T>(path, { ...options, method: 'POST', body }),
    patch: <T>(path: string, body?: ApiOptions['body'], options?: ApiOptions) =>
      request<T>(path, { ...options, method: 'PATCH', body }),
    del: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: 'DELETE' })
  }
}
