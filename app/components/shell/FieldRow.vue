<script setup lang="ts">
/**
 * One field in a grouped list, the way iOS Settings and Health edit a value:
 * the label on the left in body type, the value typed in on the right,
 * right-aligned, the unit after it. The whole row is the label, so a tap
 * anywhere on it puts the caret in the field. At least 44 px tall.
 *
 *   <div class="app-card app-divide flex flex-col">
 *     <ShellFieldRow label="Daily goal" unit="ml">
 *       <UInput v-model.number="goal" variant="none" type="number" … />
 *     </ShellFieldRow>
 *   </div>
 *
 * The input goes in the default slot with `variant="none"` and
 * `FIELD_ROW_INPUT` (app/utils/field-row.ts) as its `ui`, so it takes the row's
 * type and leaves the frame to the row. `dot` is a macro's colour mark.
 */
withDefaults(defineProps<{
  label: string
  unit?: string
  /** A colour class for a small dot before the label — a macro's own */
  dot?: string
}>(), {
  unit: undefined,
  dot: undefined
})

defineSlots<{
  /** The input */
  default?: () => unknown
}>()
</script>

<template>
  <label class="flex min-h-11 min-w-0 cursor-text items-center gap-3 px-4 transition-colors duration-120 ease-soft has-focus-visible:bg-muted motion-reduce:transition-none">
    <span
      v-if="dot"
      class="size-2.5 shrink-0 rounded-full"
      :class="dot"
      aria-hidden="true"
    />
    <span class="min-w-0 flex-1 truncate text-body text-default">{{ label }}</span>
    <span class="flex w-28 shrink-0 items-center justify-end">
      <slot />
    </span>
    <span
      v-if="unit"
      class="-ml-1.5 w-9 shrink-0 text-body text-muted"
    >{{ unit }}</span>
  </label>
</template>
