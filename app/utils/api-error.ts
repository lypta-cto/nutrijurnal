/** No answer came back at all: offline, a dropped connection, the server out
 *  of reach. Said to the public, so nothing about backends or ports. */
export const NO_CONNECTION = 'No connection — check your internet and try again.'

/**
 * Turns a failed $fetch into something worth showing a person.
 *
 * FastAPI answers with `{ detail: "..." }` for raised HTTPExceptions and with
 * `{ detail: [{ msg, loc }, ...] }` for request validation failures.
 */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  const detail = (error as { data?: { detail?: unknown } })?.data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string, loc?: (string | number)[] } | undefined

    if (first?.msg) {
      // loc looks like ["body", "password"] — the field is the last entry
      const field = first.loc?.at(-1)
      return field && field !== 'body' ? `${String(field)}: ${first.msg}` : first.msg
    }
  }

  const status = (error as { response?: { status?: number } })?.response?.status

  if (status === 0 || status === undefined) {
    return NO_CONNECTION
  }

  return fallback
}
