<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * One row of a list, as an iOS cell draws it: a plain glyph, a title in body
 * type (regular, not bold), a quiet line under it, a value or a control on the
 * right and a chevron. At least 44 px tall — the whole row is the target, and
 * it highlights grey while pressed rather than shrinking. A link with `to`, a
 * button otherwise (emits `click`); `plain` makes a plain row for one that
 * holds its own control (a switch, a select) in #trailing.
 *
 * Rows go inside a ShellList (or a flush ShellCard), which draws the hairlines
 * between them; a row with a glyph starts its hairline where its text starts.
 *
 *   <ShellListRow icon="i-lucide-scan-barcode" title="Scan barcode"
 *                 subtitle="A photo of the packet" @click="…" />
 *   <ShellListRow plain icon="i-lucide-moon" title="Theme" :chevron="false">
 *     <template #trailing><USelect … /></template>
 *   </ShellListRow>
 */
type Tone = 'primary' | 'neutral' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'warning' | 'error'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  icon?: string
  /** The glyph's colour — muted (`neutral`), the accent, a macro's ink;
   *  `error` also turns the title red, for the one row that destroys something */
  tone?: Tone
  to?: string
  /** A plain row, not a button — for rows that carry their own control */
  plain?: boolean
  chevron?: boolean
  disabled?: boolean
}>(), {
  subtitle: undefined,
  icon: undefined,
  tone: 'primary',
  to: undefined,
  plain: false,
  chevron: true,
  disabled: false
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()

defineSlots<{
  /** Replaces the glyph — an avatar, a ring */
  leading?: () => unknown
  /** Replaces the subtitle line — a ShellMacroLine, say */
  subtitle?: () => unknown
  /** A value or a control on the right */
  trailing?: () => unknown
}>()

// A glyph is a mark, not a tile: colour only where the row means something
const TONES: Record<Tone, string> = {
  primary: 'text-primary',
  neutral: 'text-muted',
  kcal: 'text-kcal-ink',
  protein: 'text-protein-ink',
  carbs: 'text-carbs-ink',
  fat: 'text-fat-ink',
  warning: 'text-warning',
  error: 'text-error'
}

const tag = computed(() => (props.plain ? 'div' : props.to ? NuxtLink : 'button'))
const interactive = computed(() => !props.plain)
</script>

<template>
  <component
    :is="tag"
    :to="plain ? undefined : to"
    :type="interactive && !to ? 'button' : undefined"
    :disabled="interactive && !to ? disabled : undefined"
    class="relative flex min-h-11 w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left"
    :class="interactive ? 'outline-none transition-colors duration-120 ease-soft hover:bg-elevated/50 focus-visible:bg-elevated active:bg-accented disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none' : ''"
    :style="icon || $slots.leading ? { '--app-divide-inset': '3.25rem' } : undefined"
    @click="(event: MouseEvent) => interactive && emit('click', event)"
  >
    <slot name="leading">
      <span
        v-if="icon"
        class="flex w-6 shrink-0 items-center justify-center"
        :class="TONES[tone]"
      >
        <UIcon
          :name="icon"
          class="size-5.5"
        />
      </span>
    </slot>

    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span
        class="truncate text-body"
        :class="tone === 'error' ? 'text-error' : 'text-default'"
      >{{ title }}</span>
      <slot name="subtitle">
        <span
          v-if="subtitle"
          class="line-clamp-2 text-footnote text-muted"
        >{{ subtitle }}</span>
      </slot>
    </span>

    <span
      v-if="$slots.trailing"
      class="flex shrink-0 items-center gap-2 text-right text-body text-muted"
    >
      <slot name="trailing" />
    </span>

    <UIcon
      v-if="chevron && interactive"
      name="i-lucide-chevron-right"
      class="size-4.5 shrink-0 text-dimmed"
    />
  </component>
</template>
