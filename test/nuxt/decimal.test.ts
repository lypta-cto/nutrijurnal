import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref } from 'vue'
import DecimalInput from '~/components/DecimalInput.vue'

describe('a number typed on a phone', () => {
  it('takes a decimal comma as well as a point', () => {
    expect(parseDecimal('72,4')).toBe(72.4)
    expect(parseDecimal('72.4')).toBe(72.4)
    expect(parseDecimal(' 1 500 ')).toBe(1500)
    expect(parseDecimal(',5')).toBe(0.5)
    expect(parseDecimal('13,2')).toBe(13.2)
  })

  it('reads a number still being typed as what it is so far', () => {
    expect(parseDecimal('72,')).toBe(72)
    expect(parseDecimal('0.')).toBe(0)
  })

  it('is nothing when empty or not a number', () => {
    for (const text of ['', '   ', ',', 'abc', '1,2,3', '7-2', '-5', null, undefined]) {
      expect(parseDecimal(text), String(text)).toBeNull()
    }
    expect(parseDecimal(Number.NaN)).toBeNull()
    expect(parseDecimal(3)).toBe(3)
  })
})

/** The field inside a parent holding the number, the way every form uses it */
async function field(start: number | null) {
  const value = ref<number | null | undefined>(start)
  const Host = defineComponent({
    setup: () => () => h(DecimalInput, {
      'modelValue': value.value,
      'onUpdate:modelValue': (next: number | null | undefined) => {
        value.value = next
      },
      'aria-label': 'Weight'
    })
  })
  const wrapper = await mountSuspended(Host)
  return { wrapper, value, input: wrapper.find('input') }
}

describe('the decimal field', () => {
  it('opens the decimal keypad on a text field the browser leaves alone', async () => {
    const { input } = await field(70)

    expect(input.attributes('type')).toBe('text')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.attributes('aria-label')).toBe('Weight')
    expect((input.element as HTMLInputElement).value).toBe('70')
  })

  it('hands a comma-typed weight to the form as a number', async () => {
    const { input, value } = await field(null)

    await input.setValue('72,4')

    expect(value.value).toBe(72.4)
    // What was typed stays as typed while the field is in use
    expect((input.element as HTMLInputElement).value).toBe('72,4')
  })

  it('does not rewrite a half-typed number under the caret, and tidies it on leaving', async () => {
    const { input, value } = await field(null)

    await input.setValue('0,')
    expect(value.value).toBe(0)
    expect((input.element as HTMLInputElement).value).toBe('0,')

    await input.trigger('blur')
    expect((input.element as HTMLInputElement).value).toBe('0')
  })

  it('reads an emptied field as nothing, not as zero', async () => {
    const { input, value } = await field(100)

    await input.setValue('')

    expect(value.value).toBeNull()
  })

  it('shows a number set from outside — a preset tapped, a form reset', async () => {
    const { wrapper, input, value } = await field(100)

    value.value = 250
    await wrapper.vm.$nextTick()

    expect((input.element as HTMLInputElement).value).toBe('250')
  })
})
