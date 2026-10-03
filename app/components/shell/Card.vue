<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * A surface for a region that holds more than a plain list: the day's rings,
 * a chart, a form, a meal slot whose header carries buttons. White on the grey
 * canvas (#1c1c1e on black), a small radius, no border, no shadow. One level
 * of surface per region — inside it, use hairlines and `bg-elevated` wells,
 * never another card. A list of rows on its own is a ShellList instead.
 *
 * Two kinds of body:
 *  - padded (default) for content: a ring, a form, a paragraph;
 *  - `flush` for rows: edge to edge, inset hairlines between them. The page
 *    lays its rows out on one shared grid, so values line up.
 *
 * The optional header is one line: glyph · title · count · quiet hint, and
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
  /** The glyph's colour — muted, unless the card is about water (`text-info`) and the like */
  iconClass?: string
  /** A number after the title, in plain muted figures */
  count?: number | string | null
  /** Quiet words after the count */
  hint?: string
  /** Rows edge to edge with hairlines, instead of a padded body */
  flush?: boolean
  /** `muted`: a sunken grey well. `brand` is still accepted and looks like `default` */
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

// Colour is for meaning, not for marking the card that matters most: `brand`
// stays as a name so callers keep working, and looks like every other card
const TONES = {
  default: 'bg-cell',
  brand: 'bg-cell',
  muted: 'bg-elevated'
} as const

const hasHeader = computed(() => Boolean(props.title || slots.header || slots.actions))
const hasBody = computed(() => Boolean(slots.default || props.isEmpty))
const hasCount = computed(() => props.count !== null && props.count !== undefined && props.count !== '')
</script>

<template>
  <component
    :is="to ? NuxtLink : 'section'"
    :to="to"
    class="flex min-w-0 flex-col overflow-hidden rounded-card"
    :class="[TONES[tone], to ? 'outline-none transition-colors duration-120 ease-soft focus-visible:ring-2 focus-visible:ring-primary active:bg-accented motion-reduce:transition-none' : '']"
  >
    <header
      v-if="hasHeader"
      class="flex min-h-11 items-center gap-2 px-4"
      :class="!hasBody ? 'py-1.5' : flush ? 'pt-2.5 pb-2' : 'pt-3'"
    >
      <slot name="header">
        <UIcon
          v-if="icon"
          :name="icon"
          class="size-5 shrink-0"
          :class="iconClass"
        />
        <!-- The title keeps its width; the quiet hint gives way first -->
        <h2
          v-if="title"
          class="max-w-full shrink-0 truncate text-headline text-highlighted"
        >
          {{ title }}
        </h2>
        <span
          v-if="hasCount"
          class="shrink-0 text-subheadline text-muted tabular-nums"
        >{{ count }}</span>
        <span
          v-if="hint"
          class="min-w-0 truncate text-subheadline text-muted"
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
      :class="flush && hasHeader ? 'app-rule-t' : ''"
    >
      <ShellSkeleton
        variant="rows"
        :count="2"
      />
    </div>

    <div
      v-else-if="isEmpty"
      :class="flush && hasHeader ? 'app-rule-t' : ''"
    >
      <slot name="empty">
        <p class="px-4 py-3 text-subheadline text-muted">
          {{ empty ?? 'Nothing here yet.' }}
        </p>
      </slot>
    </div>

    <div
      v-else-if="flush && $slots.default"
      class="app-divide flex min-h-0 flex-1 flex-col"
      :class="hasHeader ? 'app-rule-t' : ''"
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
      class="app-rule-t px-4 py-2.5"
    >
      <slot name="footer" />
    </footer>
  </component>
</template>
