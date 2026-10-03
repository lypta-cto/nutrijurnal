import { isIos } from '~/composables/usePush'

/** How a file left the app — or why it hasn't yet */
export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needs-a-tap'

/**
 * Hands a file over. On an iPhone or iPad a download link clicked after an
 * await is unreliable — the app on the Home Screen ignores it outright — so
 * where the share sheet takes files it opens that ("Save to Files", Mail,
 * AirDrop). Everywhere else "Download" means a download, as people expect.
 *
 * The share sheet wants a fresh tap too; a file that took a while to arrive
 * may no longer count as the tap that asked for it: `needs-a-tap`.
 */
export async function saveFile(blob: Blob, name: string): Promise<SaveOutcome> {
  const file = new File([blob], name, { type: blob.type })
  if (isIos() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (error) {
      const reason = (error as { name?: string } | null)?.name
      if (reason === 'AbortError') {
        // The person closed the sheet: a choice, not a failure
        return 'cancelled'
      }
      if (reason === 'NotAllowedError') {
        return 'needs-a-tap'
      }
      throw error
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'downloaded'
}

/**
 * `saveFile`, and when the file needs one more tap to leave, a toast whose
 * Save button is that tap.
 */
export function useSaveFile() {
  const toast = useToast()

  async function save(blob: Blob, name: string): Promise<SaveOutcome> {
    const outcome = await saveFile(blob, name)
    if (outcome === 'needs-a-tap') {
      toast.add({
        title: 'Your file is ready',
        description: name,
        icon: 'i-lucide-file-check',
        color: 'success',
        actions: [{ label: 'Save', color: 'neutral', variant: 'outline', onClick: () => void save(blob, name) }]
      })
    }
    return outcome
  }

  return save
}
