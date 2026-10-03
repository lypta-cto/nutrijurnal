<script setup lang="ts">
/**
 * The phone shell: one column of content and the tab bar pinned under it.
 *
 * On a wide screen the same column simply sits in the middle — this is a
 * phone app first, and a desktop window gets the phone, not a dashboard.
 */
</script>

<template>
  <div class="app-canvas min-h-svh">
    <!-- Room at the bottom for the tab bar and the home indicator under it -->
    <div class="mx-auto flex min-h-svh w-full max-w-[34rem] flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <slot />
    </div>

    <ShellBottomTabBar />

    <!-- Mounted once: every "+" in the app opens this through useQuickAdd() -->
    <QuickAddSheet />

    <ConfirmDialog />
  </div>
</template>
