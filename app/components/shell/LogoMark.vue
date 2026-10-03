<script setup lang="ts">
/**
 * The Nutrijurnal mark: the day's ring, three quarters closed, with a leaf
 * growing where the day starts. The paths are the ones scripts/make-icons.py
 * writes into public/logo.svg — change the mark there, then copy them here.
 *
 * One colour, no gradient: `brand` (the default) draws it in the accent and
 * follows the theme; `mono` draws it in `currentColor`, for a coloured tile or
 * a loading pulse.
 *
 *   <ShellLogoMark class="size-8" />
 *   <ShellLogoMark tone="mono" class="size-10 text-white" />
 */
withDefaults(defineProps<{
  tone?: 'brand' | 'mono'
}>(), {
  tone: 'brand'
})
</script>

<template>
  <!-- Cropped to the mark itself, so a size-6 mark is as big as it can be -->
  <svg
    viewBox="4 2 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="24"
      cy="25.5"
      r="13"
      stroke-width="6.5"
      :class="tone === 'mono' ? 'stroke-current opacity-30' : 'stroke-primary opacity-20'"
    />
    <path
      d="M24 12.5A13 13 0 1 1 11 25.5"
      stroke-width="6.5"
      stroke-linecap="round"
      :class="tone === 'mono' ? 'stroke-current' : 'stroke-primary'"
    />
    <path
      d="M25 11.5C25.29 5.94 32.16 2.37 37.5 5C36.13 10 29.25 13.57 25 11.5Z"
      :class="tone === 'mono' ? 'fill-current' : 'fill-primary'"
    />
  </svg>
</template>
