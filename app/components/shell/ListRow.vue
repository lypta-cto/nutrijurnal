<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * One tappable row: a tinted icon (or anything in #leading), a title with a
 * line under it, a value on the right and a chevron. At least 56 px tall —
 * the whole row is the target. A link with `to`, a button otherwise (emits
 * `click`); `plain` makes a plain row for one that holds its own control
 * (a switch, a select) in #trailing.
 *
 * For menus, settings and the ways into the diary. Lists of numbers that must
 * line up down a column keep the page's shared grid instead.
 *
 *   <ShellListRow icon="i-lucide-scan-barcode" title="Scan barcode"
 *                 subtitle="A photo of the packet" @click="…" />
 *   <ShellListRow plain icon="i-lucide-moon" tone="neutral" title="Theme" :chevron="false">
 *     <template #trailing><USelect … /></template>
 *   </ShellListRow>
 */
type Tone = 'primary' | 'neutral' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'warning' | 'error'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  icon?: string
  /** The icon tile's colour — a macro's own, or the brand's; `error` also
   *  turns the title red, for the one row that destroys something */
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
  /** Replaces the icon tile — an avatar, a ring */
  leading?: () => unknown
  /** Replaces the subtitle line — a ShellMacroLine, say */
  subtitle?: () => unknown
  /** A value or a control on the right */
  trailing?: () => unknown
}>()

const TONES: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  neutral: 'bg-elevated text-toned',
  kcal: 'bg-kcal/15 text-kcal-ink',
  protein: 'bg-protein/15 text-protein-ink',
  carbs: 'bg-carbs/15 text-carbs-ink',
  fat: 'bg-fat/15 text-fat-ink',
  warning: 'bg-warning/12 text-warning',
  error: 'bg-error/10 text-error'
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
    class="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-3 text-left"
    :class="interactive ? 'app-press outline-none hover:bg-elevated/40 focus-visible:bg-elevated/60 active:bg-elevated/70 disabled:pointer-events-none disabled:opacity-60' : ''"
    @click="(event: MouseEvent) => interactive && emit('click', event)"
  >
    <slot name="leading">
      <span
        v-if="icon"
        class="flex size-10 shrink-0 items-center justify-center rounded-xl"
        :class="TONES[tone]"
      >
        <UIcon
          :name="icon"
          class="size-5"
        />
      </span>
    </slot>

    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span
        class="truncate text-body font-semibold"
        :class="tone === 'error' ? 'text-error' : 'text-highlighted'"
      >{{ title }}</span>
      <slot name="subtitle">
        <span
          v-if="subtitle"
          class="line-clamp-2 text-xs text-muted"
        >{{ subtitle }}</span>
      </slot>
    </span>

    <span
      v-if="$slots.trailing"
      class="flex shrink-0 items-center gap-2 text-right"
    >
      <slot name="trailing" />
    </span>

    <UIcon
      v-if="chevron && interactive"
      name="i-lucide-chevron-right"
      class="size-4 shrink-0 text-dimmed"
    />
  </component>
</template>
