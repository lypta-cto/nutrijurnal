<script setup lang="ts" generic="T extends string | number">
/**
 * iOS's segmented control: two to four choices side by side on a grey track,
 * the chosen one on a white thumb (#636366 in dark mode) that slides across
 * with a spring. For switching a view in place — 7 days / 30 days, Recipes /
 * Foods — never for moving between screens. Each segment's hit area reaches
 * 44 px, though the control itself is iOS-slim.
 *
 *   <ShellSegmented
 *     v-model="span"
 *     label="Period"
 *     :options="[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }]"
 *   />
 *
 * A radio group to assistive tech: one tab stop, arrow keys move the choice.
 */
const props = withDefaults(defineProps<{
  options: { value: T, label: string, icon?: string }[]
  /** What the choice is about, for screen readers */
  label?: string
  size?: 'sm' | 'md'
}>(), {
  label: undefined,
  size: 'md'
})

const model = defineModel<T>({ required: true })

const index = computed(() => props.options.findIndex(option => option.value === model.value))
const buttons = useTemplateRef<HTMLButtonElement[]>('buttons')

function step(delta: number) {
  const count = props.options.length
  const next = ((index.value < 0 ? 0 : index.value) + delta + count) % count
  const option = props.options[next]
  if (option) {
    model.value = option.value
    buttons.value?.[next]?.focus()
  }
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="relative grid rounded-[0.5625rem] bg-elevated p-0.5"
    :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }"
    @keydown.right.prevent="step(1)"
    @keydown.down.prevent="step(1)"
    @keydown.left.prevent="step(-1)"
    @keydown.up.prevent="step(-1)"
  >
    <span
      v-if="index >= 0"
      class="absolute inset-y-0.5 left-0.5 rounded-[0.4375rem] border-[length:var(--app-hairline)] border-black/4 bg-(--app-thumb) shadow-[0_3px_8px_rgb(0_0_0/0.12),0_1px_1px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-spring motion-reduce:transition-none dark:border-transparent"
      :style="{
        width: `calc((100% - 0.25rem) / ${options.length})`,
        transform: `translateX(${index * 100}%)`
      }"
      aria-hidden="true"
    />

    <button
      v-for="(option, position) in options"
      ref="buttons"
      :key="String(option.value)"
      type="button"
      role="radio"
      :aria-checked="position === index"
      :tabindex="position === index || (index < 0 && position === 0) ? 0 : -1"
      class="app-hit relative flex min-w-0 items-center justify-center gap-1.5 rounded-[0.4375rem] text-highlighted outline-none transition-[font-weight,opacity] duration-200 ease-soft focus-visible:ring-2 focus-visible:ring-primary active:opacity-60"
      :class="[
        size === 'sm' ? 'h-7 px-1.5 text-[0.8125rem]' : 'h-8 px-3 text-subheadline',
        position === index ? 'font-semibold' : 'font-medium'
      ]"
      @click="model = option.value"
    >
      <UIcon
        v-if="option.icon"
        :name="option.icon"
        class="size-4 shrink-0"
      />
      <span class="truncate">{{ option.label }}</span>
    </button>
  </div>
</template>
