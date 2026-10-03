<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * The mark and the name together — the auth screens, and anywhere the brand
 * introduces itself. The name is set in the display face. A link home unless
 * `to` is null.
 *
 *   <ShellLogo />
 *   <ShellLogo size="lg" :to="null" />
 */
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  to?: string | null
}>(), {
  size: 'md',
  to: '/'
})

const { app } = useAppConfig()

const SIZES = {
  sm: { mark: 'size-6', name: 'text-base' },
  md: { mark: 'size-8', name: 'text-xl' },
  lg: { mark: 'size-12', name: 'text-3xl' }
} as const

const sizing = computed(() => SIZES[props.size])
</script>

<template>
  <component
    :is="to ? NuxtLink : 'span'"
    :to="to ?? undefined"
    class="inline-flex min-w-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    <ShellLogoMark
      class="shrink-0"
      :class="sizing.mark"
    />
    <span
      class="truncate font-display font-semibold tracking-[-0.01em] text-highlighted"
      :class="sizing.name"
    >{{ app.name }}</span>
  </component>
</template>
