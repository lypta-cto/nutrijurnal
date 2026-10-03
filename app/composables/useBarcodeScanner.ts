import type { Ref } from 'vue'
// Served from the app itself, never a CDN: the decoder must work offline and
// the camera's frames never leave the phone
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

/**
 * Reading a barcode live from the camera.
 *
 * Android Chrome (and other Chromium browsers) have a native
 * `BarcodeDetector`; iOS Safari and Firefox do not, so there the frames are
 * decoded by zxing-cpp compiled to WebAssembly (`zxing-wasm`), loaded only
 * when it is needed. Either way: a check digit has to add up before a code
 * counts, the phone buzzes on a hit, and the camera is let go the moment it
 * is not needed — on a hit, on leaving, and when the page is hidden.
 *
 * `getUserMedia` only exists on HTTPS (and localhost), and a person can say
 * no; both are states the page explains, with the photo upload as the way on.
 */

export type ScannerState = 'idle' | 'starting' | 'scanning' | 'denied' | 'insecure' | 'unavailable' | 'failed'

export interface ScannedCode {
  code: string
  format: string
}

type Detect = (video: HTMLVideoElement) => Promise<ScannedCode | null>

interface NativeDetector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string, format: string }[]>
}

interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector
  getSupportedFormats: () => Promise<string[]>
}

/** What a packet in a shop carries */
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
const WASM_FORMATS = ['EAN13', 'EAN8', 'UPCA', 'UPCE'] as const

/**
 * The GTIN check digit: weights 3 and 1 from the right. A frame caught
 * mid-blur almost never produces digits that pass it. UPC-E packs its digits
 * differently and is trusted to the decoder, which checks it itself.
 */
export function checksumHolds(code: string, format = ''): boolean {
  if (/upc[-_ ]?e/i.test(format)) {
    return /^\d{6,8}$/.test(code)
  }
  if (!/^(\d{8}|\d{12,14})$/.test(code)) {
    return false
  }
  const digits = code.split('').map(Number)
  const check = digits.pop() ?? -1
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

async function nativeDetector(): Promise<Detect | null> {
  const Native = (window as unknown as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (!Native) {
    return null
  }
  try {
    const supported = await Native.getSupportedFormats()
    const formats = NATIVE_FORMATS.filter(format => supported.includes(format))
    if (!formats.length) {
      return null
    }
    const detector = new Native({ formats })
    return async (video) => {
      const [hit] = await detector.detect(video)
      return hit ? { code: hit.rawValue, format: hit.format } : null
    }
  } catch {
    return null
  }
}

async function wasmDetector(): Promise<Detect> {
  const { prepareZXingModule, readBarcodes } = await import('zxing-wasm/reader')
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path)
    }
  })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    const width = video.videoWidth
    const height = video.videoHeight
    if (!context || !width || !height) {
      return null
    }
    // The middle of the picture, where the guide asks for the bars, at a
    // size a phone decodes in a few tens of milliseconds
    const cropWidth = width * 0.85
    const cropHeight = height * 0.6
    const scale = Math.min(1, 960 / cropWidth)
    canvas.width = Math.round(cropWidth * scale)
    canvas.height = Math.round(cropHeight * scale)
    context.drawImage(video, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
    const [hit] = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), {
      formats: [...WASM_FORMATS],
      tryHarder: true,
      maxNumberOfSymbols: 1
    })
    return hit?.isValid ? { code: hit.text, format: hit.format } : null
  }
}

/** How long to wait between looks — often enough to feel instant, not so often it heats the phone */
const NATIVE_INTERVAL = 120
const WASM_INTERVAL = 60

export function useBarcodeScanner(video: Ref<HTMLVideoElement | null>) {
  const state = ref<ScannerState>('idle')
  const torchSupported = ref(false)
  const torchOn = ref(false)
  /** Which decoder is reading — said in the page so a slow phone is understood */
  const engine = ref<'native' | 'wasm' | null>(null)

  let stream: MediaStream | null = null
  let detect: Detect | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let onCode: ((hit: ScannedCode) => void) | null = null
  let wanted = false

  function track(): MediaStreamTrack | null {
    return stream?.getVideoTracks()[0] ?? null
  }

  function release() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    stream?.getTracks().forEach(entry => entry.stop())
    stream = null
    torchOn.value = false
    torchSupported.value = false
    if (video.value) {
      video.value.srcObject = null
    }
  }

  async function look() {
    timer = null
    const element = video.value
    if (!wanted || !detect || !element || element.readyState < 2) {
      schedule()
      return
    }
    try {
      const hit = await detect(element)
      if (hit && wanted && checksumHolds(hit.code, hit.format)) {
        wanted = false
        navigator.vibrate?.(60)
        release()
        state.value = 'idle'
        onCode?.(hit)
        return
      }
    } catch {
      // One unreadable frame is not a failure — the next one is coming
    }
    schedule()
  }

  function schedule() {
    if (wanted && !timer) {
      timer = setTimeout(() => void look(), engine.value === 'wasm' ? WASM_INTERVAL : NATIVE_INTERVAL)
    }
  }

  async function start(handler: (hit: ScannedCode) => void) {
    onCode = handler
    wanted = true
    if (!window.isSecureContext) {
      state.value = 'insecure'
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      state.value = 'unavailable'
      return
    }
    state.value = 'starting'
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
    } catch (error) {
      const name = (error as DOMException)?.name
      state.value = name === 'NotAllowedError' || name === 'SecurityError'
        ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'unavailable' : 'failed'
      return
    }
    // Walked away while the permission prompt was up
    if (!wanted || !video.value) {
      release()
      return
    }
    const element = video.value
    element.srcObject = stream
    element.muted = true
    element.setAttribute('playsinline', '')
    try {
      await element.play()
    } catch {
      state.value = 'failed'
      release()
      return
    }

    const camera = track()
    const capabilities = (camera?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean, focusMode?: string[] }
    torchSupported.value = Boolean(capabilities.torch)
    if (capabilities.focusMode?.includes('continuous')) {
      // A packet is held close; a camera stuck on infinity never reads it
      await camera?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
    }

    if (!detect) {
      const native = await nativeDetector()
      engine.value = native ? 'native' : 'wasm'
      detect = native ?? await wasmDetector().catch(() => null)
    }
    if (!detect) {
      state.value = 'failed'
      release()
      return
    }
    state.value = 'scanning'
    schedule()
  }

  function stop() {
    wanted = false
    release()
    if (state.value === 'scanning' || state.value === 'starting') {
      state.value = 'idle'
    }
  }

  async function toggleTorch() {
    const camera = track()
    if (!camera || !torchSupported.value) {
      return
    }
    const next = !torchOn.value
    try {
      await camera.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      torchOn.value = next
    } catch {
      torchSupported.value = false
    }
  }

  // A hidden page must not keep the camera light on; coming back picks up again
  let resumeWith: ((hit: ScannedCode) => void) | null = null

  function onVisibility() {
    if (document.hidden && state.value === 'scanning') {
      const handler = onCode
      stop()
      resumeWith = handler
    } else if (!document.hidden && resumeWith) {
      const handler = resumeWith
      resumeWith = null
      void start(handler)
    }
  }

  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    resumeWith = null
    stop()
  })

  return { state, engine, torchSupported, torchOn, start, stop, toggleTorch }
}
