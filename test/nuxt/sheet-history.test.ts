import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { useSheetHistory } from '~/composables/useSheetHistory'

const mounted: { unmount: () => void }[] = []
const marked = () => history.state?.nutrijurnalSheet === true

/** Sheets on a page, each opened by its own ref, the way every sheet is */
async function sheets(count: number): Promise<Ref<boolean>[]> {
  const opens = Array.from({ length: count }, () => ref(false))
  mounted.push(await mountSuspended(defineComponent({
    setup() {
      opens.forEach(open => useSheetHistory(open))
      return () => h('div')
    }
  })))
  return opens
}

/** Whatever the test left open is closed, and its entry taken back out */
afterEach(async () => {
  mounted.splice(0).forEach(host => host.unmount())
  await vi.waitFor(() => expect(marked()).toBe(false))
})

async function back() {
  history.back()
  await new Promise(resolve => setTimeout(resolve, 20))
  await nextTick()
}

describe('the back gesture with a sheet open', () => {
  it('closes the sheet, and the page under it stays where it was', async () => {
    const [sheet] = await sheets(1)
    const page = useRouter().currentRoute.value.fullPath
    sheet!.value = true
    await nextTick()
    expect(marked()).toBe(true)

    await back()

    expect(sheet!.value).toBe(false)
    expect(marked()).toBe(false)
    expect(useRouter().currentRoute.value.fullPath).toBe(page)
  })

  it('leaves no step behind when the sheet is closed with a tap', async () => {
    const [sheet] = await sheets(1)
    const before = history.length

    for (let time = 0; time < 3; time += 1) {
      sheet!.value = true
      await nextTick()
      sheet!.value = false
      await nextTick()
      await vi.waitFor(() => expect(marked()).toBe(false))
    }

    // Each opening replaced the step the last one took out, never added to it
    expect(history.length).toBeLessThanOrEqual(before + 1)
    sheet!.value = true
    await nextTick()
    await back()
    expect(sheet!.value).toBe(false)
  })

  it('closes only the newest of two sheets, then the one under it', async () => {
    const [form, picker] = await sheets(2)
    form!.value = true
    await nextTick()
    picker!.value = true
    await nextTick()

    await back()
    expect([form!.value, picker!.value]).toEqual([true, false])
    expect(marked()).toBe(true)

    await back()
    expect(form!.value).toBe(false)
    expect(marked()).toBe(false)
  })

  it('keeps one step when one sheet hands over to another', async () => {
    const [list, form] = await sheets(2)
    list!.value = true
    await nextTick()
    const opened = history.length

    // The "+" sheet steps aside for the full form in the same moment
    list!.value = false
    form!.value = true
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(marked()).toBe(true)
    expect(history.length).toBe(opened)
    await back()
    expect(form!.value).toBe(false)
    expect(marked()).toBe(false)
  })

  it('lets a page change start from the page’s own step, and still closes the sheet first', async () => {
    registerEndpoint('/api/v1/auth/refresh', { method: 'POST', handler: () => {
      throw createError({ statusCode: 401 })
    } })
    registerEndpoint('/api/v1/auth/providers', () => ({ google: false }))
    const router = useRouter()
    const page = router.currentRoute.value.fullPath
    const [sheet] = await sheets(1)
    sheet!.value = true
    await nextTick()

    await router.push('/register')
    await vi.waitFor(() => expect(marked()).toBe(true))
    expect(router.currentRoute.value.path).toBe('/register')

    await back()
    expect(sheet!.value).toBe(false)
    expect(router.currentRoute.value.path).toBe('/register')

    // One more Back is the page before — no dead step from the sheet in between
    history.back()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(page))
  })

  it('lets a jump of more than one step through to the router, closing the sheet on the way', async () => {
    registerEndpoint('/api/v1/auth/refresh', { method: 'POST', handler: () => {
      throw createError({ statusCode: 401 })
    } })
    registerEndpoint('/api/v1/auth/providers', () => ({ google: false }))
    const router = useRouter()
    const page = router.currentRoute.value.fullPath
    await router.push('/register')
    const [sheet] = await sheets(1)
    sheet!.value = true
    await nextTick()

    // A long press on Back, two pages at once
    history.go(-2)

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(page))
    expect(sheet!.value).toBe(false)
  })
})
