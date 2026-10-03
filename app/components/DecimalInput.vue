<script setup lang="ts">
/**
 * A number field that takes a decimal comma.
 *
 * A `type="number"` field is checked by the browser against the page's own
 * language, not the phone's: on an iPhone set to a comma region, "72,4"
 * typed on the decimal keypad reads back as "" — a weight is refused and an
 * amount silently becomes nothing. So this is a text field with the decimal
 * keypad, read by `parseDecimal`, which takes either separator.
 *
 * The model is the number, or null while the field is empty or holds
 * something that isn't one. Everything else (size, ui, aria-label, @blur …)
 * goes straight through to the UInput.
 */
defineOptions({ inheritAttrs: false })

const model = defineModel<number | null | undefined>()
defineSlots<{ trailing?: () => unknown }>()

function shown(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

const text = ref(shown(model.value))

// A value set from outside (a reset, a preset tapped) replaces what is typed;
// the number just typed must not rewrite "0," back to "0" under the caret
watch(model, (value) => {
  if (parseDecimal(text.value) !== (value ?? null)) {
    text.value = shown(value)
  }
})

function onInput(value: string | number | null | undefined) {
  text.value = value === null || value === undefined ? '' : String(value)
  model.value = parseDecimal(text.value)
}

/** "72," reads as 72 once the field is left */
function tidy() {
  text.value = shown(model.value)
}
</script>

<template>
  <UInput
    v-bind="$attrs"
    :model-value="text"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    @update:model-value="onInput"
    @blur="tidy"
  >
    <template
      v-if="$slots.trailing"
      #trailing
    >
      <slot name="trailing" />
    </template>
  </UInput>
</template>
