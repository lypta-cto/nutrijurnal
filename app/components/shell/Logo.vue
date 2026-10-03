<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * The mark and the name together — the auth screens, and anywhere the brand
 * introduces itself. The name is the system face, semibold: a wordmark, not a
 * logotype. A link home unless `to` is null.
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
  sm: { mark: 'size-6', name: 'text-headline' },
  md: { mark: 'size-7', name: 'text-title3' },
  lg: { mark: 'size-10', name: 'text-title' }
} as const

const sizing = computed(() => SIZES[props.size])
</script>

<template>
  <component
    :is="to ? NuxtLink : 'span'"
    :to="to ?? undefined"
    class="inline-flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    <ShellLogoMark
      class="shrink-0"
      :class="sizing.mark"
    />
    <span
      class="truncate font-semibold text-highlighted"
      :class="sizing.name"
    >{{ app.name }}</span>
  </component>
</template>
