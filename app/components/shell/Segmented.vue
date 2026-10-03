<script setup lang="ts" generic="T extends string | number">
/**
 * A segmented control: two to four choices side by side, the chosen one on a
 * raised thumb that slides across. For switching a view in place — 7 days /
 * 30 days, Recipes / Foods — never for moving between screens.
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
    class="relative grid rounded-full bg-elevated p-1"
    :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }"
    @keydown.right.prevent="step(1)"
    @keydown.down.prevent="step(1)"
    @keydown.left.prevent="step(-1)"
    @keydown.up.prevent="step(-1)"
  >
    <!-- The thumb comes forward: white on the track in light mode, a step
         lighter than it in dark, where surfaces lighten instead of casting shadows -->
    <span
      v-if="index >= 0"
      class="absolute inset-y-1 left-1 rounded-full bg-default shadow-card ring-1 ring-default transition-transform duration-300 ease-soft motion-reduce:transition-none dark:bg-accented"
      :style="{
        width: `calc((100% - 0.5rem) / ${options.length})`,
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
      class="relative flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 font-semibold outline-none transition-colors duration-200 ease-soft focus-visible:ring-2 focus-visible:ring-primary"
      :class="[
        size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm',
        position === index ? 'text-highlighted' : 'text-muted hover:text-default'
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
