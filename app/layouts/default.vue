<script setup lang="ts">
/**
 * The phone shell: one column of content on the cream canvas, a soft light
 * at the top of the screen, and the floating tab bar pinned under it.
 *
 * On a wide screen the same column simply sits in the middle — this is a
 * phone app first, and a desktop window gets the phone, not a dashboard.
 */
</script>

<template>
  <div class="app-canvas relative min-h-svh">
    <!-- Fixed, so the light stays at the top while the cards scroll over it -->
    <div
      class="app-wash pointer-events-none fixed inset-x-0 top-0 h-80"
      aria-hidden="true"
    />

    <!-- Room at the bottom for the tab bar, its raised "+" and the home indicator -->
    <div class="relative mx-auto flex min-h-svh w-full max-w-(--app-column) flex-col pb-(--app-tabbar-space)">
      <slot />
    </div>

    <ShellBottomTabBar />

    <!-- Mounted once: every "+" in the app opens this through useQuickAdd() -->
    <QuickAddSheet />

    <ConfirmDialog />
  </div>
</template>
