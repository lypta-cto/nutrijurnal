/**
 * A number as a person types it on a phone: "72,4" where the region writes a
 * decimal comma, "72.4" elsewhere, a space left over from a paste, a "72,"
 * half-way through typing. Null when it is empty or not a number at all.
 */
export function parseDecimal(text: string | number | null | undefined): number | null {
  if (typeof text === 'number') {
    return Number.isFinite(text) ? text : null
  }
  const cleaned = (text ?? '').replace(/\s+/g, '').replace(',', '.')
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) {
    return null
  }
  return Number(cleaned)
}
