<script setup lang="ts">
const { state, respond } = useConfirm()

const color = computed(() => state.value.color ?? 'primary')

const icon = computed(() =>
  state.value.icon ?? (color.value === 'error' ? 'i-lucide-trash-2' : 'i-lucide-circle-alert')
)
</script>

<template>
  <UModal
    :open="state.open"
    :title="state.title"
    :description="state.description"
    :ui="{ overlay: 'z-[60]', content: 'z-[60] max-w-sm', header: 'hidden' }"
    @update:open="value => !value && respond(false)"
  >
    <template #content>
      <div class="flex flex-col items-center gap-3 px-5 pt-6 pb-5 text-center">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-full"
          :class="color === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'"
        >
          <UIcon
            :name="icon"
            class="size-6"
          />
        </span>

        <div class="min-w-0">
          <p class="text-headline font-semibold text-highlighted">
            {{ state.title }}
          </p>
          <p
            v-if="state.description"
            class="mt-1 text-sm text-muted"
          >
            {{ state.description }}
          </p>
        </div>

        <div class="mt-3 flex w-full flex-col gap-2">
          <UButton
            :label="state.confirmLabel ?? 'Confirm'"
            :color="color"
            size="lg"
            block
            @click="respond(true)"
          />
          <UButton
            :label="state.cancelLabel ?? 'Cancel'"
            color="neutral"
            variant="ghost"
            size="lg"
            block
            @click="respond(false)"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
