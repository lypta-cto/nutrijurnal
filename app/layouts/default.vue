<script setup lang="ts">
/**
 * The phone shell: one column of content on the grey canvas, and the glass
 * tab bar floating over the bottom of it.
 *
 * On a wide screen the same column simply sits in the middle — this is a
 * phone app first, and a desktop window gets the phone, not a dashboard.
 */
</script>

<template>
  <div class="app-canvas min-h-svh">
    <!-- Room at the bottom for the tab bar and the home indicator -->
    <div class="relative mx-auto flex min-h-svh w-full max-w-(--app-column) flex-col pb-(--app-tabbar-space)">
      <slot />
    </div>

    <ShellBottomTabBar />

    <!-- Mounted once: every "+" in the app opens this through useQuickAdd() -->
    <QuickAddSheet />

    <ConfirmDialog />
  </div>
</template>
