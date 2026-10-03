<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * The card every screen is built of: white on the cream canvas, a soft radius
 * and a hairline. One level of card per region — inside it, use hairlines and
 * `bg-elevated` wells, not more cards.
 *
 * Two kinds of body:
 *  - padded (default) for content: a ring, a form, a paragraph;
 *  - `flush` for a list: rows run edge to edge with hairlines between them.
 *    The page lays its rows out on one shared grid, so values line up.
 *
 * The optional header is one line: icon · title · count pill · quiet hint, and
 * #actions on the right. `isEmpty` swaps the body for `empty` (or #empty) and
 * `loading` + `isEmpty` for a skeleton — a list card never collapses to nothing.
 * A card with a header and no body at all (no default slot, not empty, not
 * loading) is just that one line — an empty meal slot with its "+".
 *
 *   <ShellCard title="Breakfast" icon="i-lucide-coffee" :count="2" hint="420 kcal" flush
 *              :is-empty="!meals.length" empty="Nothing yet.">
 *     <template #actions><UButton icon="i-lucide-plus" size="sm" … /></template>
 *     <div v-for="meal in meals" :key="meal.id" class="grid …">…</div>
 *   </ShellCard>
 */
const props = withDefaults(defineProps<{
  title?: string
  icon?: string
  /** The icon's colour — muted, unless the card is about water (`text-info`) and the like */
  iconClass?: string
  /** A small pill after the title */
  count?: number | string | null
  /** Quiet words after the count */
  hint?: string
  /** Rows edge to edge with hairlines, instead of a padded body */
  flush?: boolean
  /** `brand`: a soft green wash for the one card that leads a screen; `muted`: a sunken well */
  tone?: 'default' | 'brand' | 'muted'
  /** The whole card is a link (then don't put buttons in it) */
  to?: string
  loading?: boolean
  isEmpty?: boolean
  /** Said instead of the body when `isEmpty` and #empty isn't given */
  empty?: string
}>(), {
  title: undefined,
  icon: undefined,
  iconClass: 'text-muted',
  count: null,
  hint: undefined,
  flush: false,
  tone: 'default',
  to: undefined,
  loading: false,
  isEmpty: false,
  empty: undefined
})

const slots = defineSlots<{
  default?: () => unknown
  /** Replaces icon, title, count and hint */
  header?: () => unknown
  /** Buttons on the right of the header */
  actions?: () => unknown
  /** Replaces the `empty` sentence — a ShellEmpty with a button, say */
  empty?: () => unknown
  /** A last row under a hairline: a total, a "show all" link */
  footer?: () => unknown
}>()

const TONES = {
  default: 'bg-default border-default shadow-card',
  brand: 'bg-linear-to-br from-primary-50 via-default to-default border-primary-100 shadow-card dark:from-primary-950/60 dark:via-default dark:border-primary-900/60',
  muted: 'bg-elevated/70 border-transparent shadow-none'
} as const

const hasHeader = computed(() => Boolean(props.title || slots.header || slots.actions))
const hasBody = computed(() => Boolean(slots.default || props.isEmpty))
const hasCount = computed(() => props.count !== null && props.count !== undefined && props.count !== '')
</script>

<template>
  <component
    :is="to ? NuxtLink : 'section'"
    :to="to"
    class="flex min-w-0 flex-col overflow-hidden rounded-card border"
    :class="[TONES[tone], to ? 'app-press outline-none focus-visible:ring-2 focus-visible:ring-primary' : '']"
  >
    <header
      v-if="hasHeader"
      class="flex min-h-14 items-center gap-2 px-4"
      :class="!hasBody ? 'py-2' : flush ? 'pt-3 pb-2.5' : 'pt-3'"
    >
      <slot name="header">
        <UIcon
          v-if="icon"
          :name="icon"
          class="size-4.5 shrink-0"
          :class="iconClass"
        />
        <h2
          v-if="title"
          class="truncate text-headline font-semibold text-highlighted"
        >
          {{ title }}
        </h2>
        <span
          v-if="hasCount"
          class="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-caption font-semibold tabular-nums text-toned"
        >{{ count }}</span>
        <span
          v-if="hint"
          class="truncate text-xs text-muted"
        >{{ hint }}</span>
      </slot>

      <div
        v-if="$slots.actions"
        class="ml-auto flex shrink-0 items-center gap-1"
      >
        <slot name="actions" />
      </div>
    </header>

    <div
      v-if="loading && isEmpty"
      :class="flush && hasHeader ? 'border-t border-default' : ''"
    >
      <ShellSkeleton
        variant="rows"
        :count="2"
      />
    </div>

    <div
      v-else-if="isEmpty"
      :class="flush && hasHeader ? 'border-t border-default' : ''"
    >
      <slot name="empty">
        <p class="px-4 py-3.5 text-sm text-muted">
          {{ empty ?? 'Nothing here yet.' }}
        </p>
      </slot>
    </div>

    <div
      v-else-if="flush && $slots.default"
      class="flex min-h-0 flex-1 flex-col divide-y divide-default"
      :class="hasHeader ? 'border-t border-default' : ''"
    >
      <slot />
    </div>

    <div
      v-else-if="$slots.default"
      class="flex min-w-0 flex-1 flex-col p-4"
      :class="hasHeader ? 'pt-2' : ''"
    >
      <slot />
    </div>

    <footer
      v-if="$slots.footer"
      class="border-t border-default px-4 py-2.5"
    >
      <slot name="footer" />
    </footer>
  </component>
</template>
