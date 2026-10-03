import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveFile, useSaveFile } from '~/composables/useSaveFile'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

const pdf = () => new Blob(['%PDF-1.7'], { type: 'application/pdf' })
let clicked: HTMLAnchorElement[] = []
let share: ReturnType<typeof vi.fn>

function on(agent: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent)
}

beforeEach(() => {
  clicked = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this)
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:nutrijurnal/file')
  share = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (navigator as Partial<Navigator>).share
  delete (navigator as Partial<Navigator>).canShare
})

describe('handing a file over', () => {
  it('opens the share sheet on an iPhone, where a late download link is ignored', async () => {
    on(IPHONE)

    expect(await saveFile(pdf(), 'nutrijurnal_2026-09-15_2026-09-21.pdf')).toBe('shared')

    const [[{ files }]] = share.mock.calls as [[{ files: File[] }]]
    expect(files.map(file => [file.name, file.type])).toEqual([['nutrijurnal_2026-09-15_2026-09-21.pdf', 'application/pdf']])
    expect(clicked).toEqual([])
  })

  it('downloads everywhere else, as "Download" promises', async () => {
    on(ANDROID)

    expect(await saveFile(pdf(), 'diary.pdf')).toBe('downloaded')

    expect(share).not.toHaveBeenCalled()
    expect(clicked.map(link => [link.download, link.href])).toEqual([['diary.pdf', 'blob:nutrijurnal/file']])
  })

  it('downloads on an iPhone whose share sheet can’t take files', async () => {
    on(IPHONE)
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })

    expect(await saveFile(pdf(), 'diary.pdf')).toBe('downloaded')
    expect(share).not.toHaveBeenCalled()
  })

  it('takes a closed share sheet as a choice, not a failure', async () => {
    on(IPHONE)
    share.mockRejectedValue(new DOMException('Share canceled', 'AbortError'))

    expect(await saveFile(pdf(), 'diary.pdf')).toBe('cancelled')
    expect(clicked).toEqual([])
  })

  it('offers one more tap when the file arrived too late to count as the first', async () => {
    on(IPHONE)
    share.mockRejectedValueOnce(new DOMException('Needs a gesture', 'NotAllowedError'))
    const toasts = useToast()
    const save = useSaveFile()

    expect(await save(pdf(), 'diary.pdf')).toBe('needs-a-tap')

    const offer = toasts.toasts.value.at(-1)!
    expect(offer.title).toBe('Your file is ready')
    const [again] = offer.actions as { label: string, onClick: () => void }[]
    expect(again!.label).toBe('Save')
    again!.onClick()
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(2))
  })
})
