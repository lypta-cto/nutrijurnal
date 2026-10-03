import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { DICTATION_LANGUAGES, useVoiceNote } from '~/composables/useVoiceNote'

/** The recorder inside a component, the way VoiceMeal holds it */
async function recorder() {
  let voice: ReturnType<typeof useVoiceNote> | undefined
  await mountSuspended(defineComponent({
    setup() {
      voice = useVoiceNote()
      return () => h('div')
    }
  }))
  return voice!
}

/** A recorder that exists — whether it ever gets to start is what is tested */
const Recorder = Object.assign(function Recorder() {}, { isTypeSupported: () => true })

/** happy-dom has no secure-context flag of its own; a browser always does */
function secure(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'isSecureContext')
})

describe('recording a meal out loud', () => {
  it('says a plain-http page is the problem, not the microphone permission', async () => {
    vi.stubGlobal('MediaRecorder', Recorder)
    secure(false)
    const voice = await recorder()

    expect(await voice.start()).toBe(false)

    expect(voice.error.value).toBe('The microphone needs a secure connection — open the app over https.')
  })

  it('tells a refused permission from a device with no microphone', async () => {
    vi.stubGlobal('MediaRecorder', Recorder)
    secure(true)
    const getUserMedia = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } })
    const voice = await recorder()

    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    await voice.start()
    expect(voice.error.value).toBe('No microphone — check the permission the browser asked for.')

    getUserMedia.mockRejectedValueOnce(new DOMException('none', 'NotFoundError'))
    await voice.start()
    expect(voice.error.value).toBe('No microphone found on this device.')
  })

  it('turns the microphone off again when the recorder will not start', async () => {
    const stop = vi.fn()
    vi.stubGlobal('MediaRecorder', Object.assign(function () {
      throw new DOMException('no such type', 'NotSupportedError')
    }, { isTypeSupported: () => false }))
    secure(true)
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) }
    })
    const voice = await recorder()

    expect(await voice.start()).toBe(false)

    expect(stop).toHaveBeenCalled()
    expect(voice.recording.value).toBe(false)
  })

  it('turns the microphone off and says why when the recording will not begin', async () => {
    const stop = vi.fn()
    vi.stubGlobal('MediaRecorder', Object.assign(function () {
      return {
        start: () => {
          throw new DOMException('the device is busy', 'NotSupportedError')
        }
      }
    }, { isTypeSupported: () => true }))
    secure(true)
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) }
    })
    const voice = await recorder()

    expect(await voice.start()).toBe(false)

    expect(stop).toHaveBeenCalled()
    expect(voice.recording.value).toBe(false)
    expect(voice.error.value).toBe('The recording couldn\'t start — try again, or type what you ate.')
    // Nothing half-started is left for a later stop to trip over
    expect(await voice.stop()).toBeNull()
  })

  it('names its languages in English', () => {
    expect(DICTATION_LANGUAGES.map(entry => entry.label)).toEqual(['Serbian', 'English'])
  })
})
