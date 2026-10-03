<script setup lang="ts">
/**
 * A form in a bottom sheet: title, the fields scrolling in the middle, and
 * the buttons pinned at the bottom where the thumb already is — Cancel quiet
 * on the left, the one thing the sheet is for filling the rest. The submit
 * button belongs to the form through `form="form-sheet"`, so Enter in a
 * field submits too.
 */
withDefaults(defineProps<{
  title: string
  description?: string
  submitLabel?: string
  cancelLabel?: string
  loading?: boolean
  /** Disable the submit button — pass your form's validity */
  disabled?: boolean
}>(), {
  submitLabel: 'Save',
  cancelLabel: 'Cancel',
  loading: false,
  disabled: false
})

const emit = defineEmits<{
  submit: []
  cancel: []
}>()

const open = defineModel<boolean>('open', { default: false })
// Back closes the sheet rather than leaving the page under it
useSheetHistory(open)

defineSlots<{
  /** Form fields */
  default?: () => unknown
  /** Replaces the footer buttons entirely */
  footer?: () => unknown
}>()

function cancel() {
  emit('cancel')
  open.value = false
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="title"
    :description="description"
    :ui="{ ...SHEET_UI, body: 'flex-1 overflow-y-auto' }"
  >
    <template #body>
      <form
        id="form-sheet"
        class="space-y-5"
        @submit.prevent="emit('submit')"
      >
        <slot />
      </form>
    </template>

    <template #footer>
      <slot name="footer">
        <div class="flex w-full gap-2">
          <UButton
            :label="cancelLabel"
            color="neutral"
            variant="ghost"
            size="lg"
            :disabled="loading"
            @click="cancel"
          />
          <UButton
            type="submit"
            form="form-sheet"
            :label="submitLabel"
            size="lg"
            class="flex-1 justify-center"
            :loading="loading"
            :disabled="disabled"
          />
        </div>
      </slot>
    </template>
  </UDrawer>
</template>
