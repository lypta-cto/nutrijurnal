export interface ImportResult {
  foods: number
  recipes: number
  meals: number
  water: number
  weight: number
  skipped: number
  warnings: string[]
}

const NOUNS: [keyof ImportResult, string, string][] = [
  ['meals', 'meal', 'meals'],
  ['recipes', 'recipe', 'recipes'],
  ['foods', 'food', 'foods'],
  ['weight', 'weighing', 'weighings'],
  ['water', 'glass of water', 'glasses of water']
]

/** "Added 37 meals and 82 recipes · 3 already here" — what an import did, in a line */
export function importSummary(result: ImportResult): string {
  const added = NOUNS
    .map(([key, one, many]) => [result[key] as number, one, many] as const)
    .filter(([count]) => count > 0)
    .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`)
  const kept = result.skipped ? `${result.skipped} already here` : ''
  if (!added.length) {
    return kept ? `Nothing new — ${kept}` : 'Nothing to add in that file'
  }
  const list = added.length > 1 ? `${added.slice(0, -1).join(', ')} and ${added.at(-1)}` : added[0]
  return [`Added ${list}`, kept].filter(Boolean).join(' · ')
}

/**
 * A Nutrijurnal backup (.json) or a diary export (.csv) — this app's or the
 * CTO Productivity App's, which writes the same columns — into the account.
 * The server leaves alone whatever is already here, so a file can go twice.
 */
export function useImportDiary() {
  const api = useApi()

  async function importFile(file: File): Promise<ImportResult> {
    const form = new FormData()
    form.append('file', file, file.name)
    return api.post<ImportResult>('/auth/me/import', form)
  }

  return { importFile }
}
