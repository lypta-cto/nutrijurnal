/**
 * Say the plate out loud, with both hands busy.
 *
 * Two things happen at once and neither depends on the other:
 *
 * - **MediaRecorder** keeps the audio. This works everywhere the app runs,
 *   and it is the part that must not fail — a recording can always be listened
 *   to later, or run through a transcriber that does know Serbian.
 * - **SpeechRecognition** writes the words down as they are said, when the
 *   browser has it. Chrome on the laptop does, with `sr-RS`. A phone very
 *   likely does not: iOS dictation has no Serbian at all. So the transcript is
 *   a bonus, never the point.
 *
 * The recorder therefore never waits for the recogniser, and stopping returns
 * whatever both of them managed.
 */

/** The languages the parser reads amounts and meal words in */
export const DICTATION_LANGUAGES: { value: string, label: string }[] = [
  { value: 'sr-RS', label: 'Serbian' },
  { value: 'en-US', label: 'English' }
]

const LANGUAGE_KEY = 'nutrijurnal-dictation-language'

/**
 * Which language dictation listens for. The pantry's foods are Serbian and
 * the parser reads Serbian amounts ("pola banane", "merica whey") as well as
 * English ones, so the choice is the speaker's: remembered per device, and
 * guessed from the browser's own language the first time.
 */
export function useDictationLanguage() {
  const language = useState<string>('dictation-language', () => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY)
      if (saved && DICTATION_LANGUAGES.some(entry => entry.value === saved)) {
        return saved
      }
    } catch {
      // Storage refused (private mode) — the guess below is good enough
    }
    const spoken = navigator.language?.toLowerCase() ?? ''
    return /^(sr|hr|bs|sh|cnr)\b/.test(spoken) ? 'sr-RS' : 'en-US'
  })

  watch(language, (value) => {
    try {
      localStorage.setItem(LANGUAGE_KEY, value)
    } catch {
      // Remembering is a convenience, not a requirement
    }
  })

  return language
}

/** What the browser will actually record in, best first */
const FORMATS = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4', // Safari, iOS
  'audio/ogg;codecs=opus',
  'audio/aac'
]

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { resultIndex: number, results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

function recogniser(): Recognition | null {
  if (import.meta.server) {
    return null
  }
  const holder = window as unknown as {
    SpeechRecognition?: new () => Recognition
    webkitSpeechRecognition?: new () => Recognition
  }
  const Engine = holder.SpeechRecognition ?? holder.webkitSpeechRecognition
  return Engine ? new Engine() : null
}

export interface VoiceTake {
  blob: Blob
  seconds: number
  /** What the browser heard, when it could hear */
  transcript: string
}

export function useVoiceNote() {
  const recording = ref(false)
  const seconds = ref(0)
  /** Live text while talking — the settled part plus what is still being said */
  const transcript = ref('')
  const error = ref<string | null>(null)
  /** Why dictation gave up mid-way, when it did — the recording carries on regardless */
  const dictationFailed = ref<string | null>(null)

  const supported = computed(() => import.meta.client && typeof MediaRecorder !== 'undefined')
  const canTranscribe = computed(() => import.meta.client && recogniser() !== null)

  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let heard: Recognition | null = null
  let settled = ''
  let ticker: ReturnType<typeof setInterval> | null = null
  let stream: MediaStream | null = null

  function format(): string {
    return FORMATS.find(type => MediaRecorder.isTypeSupported(type)) ?? ''
  }

  /** The microphone's light goes out with this */
  function releaseMicrophone() {
    stream?.getTracks().forEach(track => track.stop())
    stream = null
  }

  function listen(language: string) {
    heard = recogniser()
    if (!heard) {
      return
    }
    settled = ''
    heard.lang = language
    heard.continuous = true
    heard.interimResults = true
    heard.onresult = (event) => {
      let pending = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const words = result?.[0]?.transcript ?? ''
        if (result?.isFinal) {
          settled += words
        } else {
          pending += words
        }
      }
      transcript.value = (settled + pending).trim()
    }
    // A recogniser that gives up is not a failed recording: the audio is
    // still being kept, so this is only remembered to explain afterwards
    heard.onerror = (event) => {
      if (event?.error && event.error !== 'aborted' && event.error !== 'no-speech') {
        dictationFailed.value = event.error
      }
    }
    try {
      heard.start()
    } catch {
      heard = null
    }
  }

  async function start(language = 'sr-RS'): Promise<boolean> {
    error.value = null
    dictationFailed.value = null
    transcript.value = ''
    seconds.value = 0

    if (!supported.value) {
      error.value = 'This browser cannot record audio.'
      return false
    }
    // Browsers only hand the microphone to a secure page: on plain http (a
    // phone trying the app over the LAN) `mediaDevices` is simply missing,
    // which is not the person's permission to fix
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      error.value = 'The microphone needs a secure connection — open the app over https.'
      return false
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (failure) {
      error.value = (failure as { name?: string })?.name === 'NotFoundError'
        ? 'No microphone found on this device.'
        : 'No microphone — check the permission the browser asked for.'
      return false
    }

    const type = format()
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    } catch {
      // The microphone is open by now; a recorder that won't start must not
      // leave its light on
      releaseMicrophone()
      error.value = 'This browser cannot record audio.'
      return false
    }
    chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunks.push(event.data)
      }
    }
    try {
      recorder.start()
    } catch {
      // A recorder can be made and still refuse to start (a format it named
      // but can't encode, the microphone taken by a call) — same light
      releaseMicrophone()
      recorder = null
      error.value = 'The recording couldn\'t start — try again, or type what you ate.'
      return false
    }
    recording.value = true

    const began = Date.now()
    ticker = setInterval(() => {
      seconds.value = (Date.now() - began) / 1000
    }, 200)

    listen(language)
    return true
  }

  /** Hand back the recording — and the words, if any were caught */
  function stop(): Promise<VoiceTake | null> {
    return new Promise((resolve) => {
      if (!recorder || !recording.value) {
        resolve(null)
        return
      }

      const taken = recorder
      taken.onstop = () => {
        const blob = new Blob(chunks, { type: taken.mimeType || 'audio/webm' })
        releaseMicrophone()
        recorder = null
        recording.value = false
        resolve({ blob, seconds: seconds.value, transcript: transcript.value.trim() })
      }

      if (ticker) {
        clearInterval(ticker)
        ticker = null
      }
      try {
        heard?.stop()
      } catch {
        // already gone
      }
      heard = null
      taken.stop()
    })
  }

  /** Walk away from it: nothing is kept, the microphone light goes out */
  function cancel() {
    if (ticker) {
      clearInterval(ticker)
      ticker = null
    }
    try {
      heard?.stop()
    } catch {
      // already gone
    }
    heard = null
    if (recorder && recording.value) {
      recorder.onstop = null
      recorder.stop()
    }
    releaseMicrophone()
    recorder = null
    chunks = []
    recording.value = false
    seconds.value = 0
    transcript.value = ''
  }

  onBeforeUnmount(cancel)

  return { supported, canTranscribe, recording, seconds, transcript, error, dictationFailed, start, stop, cancel }
}

/** "1:07" — a recording is read in minutes and seconds, never in 67 */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
