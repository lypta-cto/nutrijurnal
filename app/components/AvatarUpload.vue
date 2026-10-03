<script setup lang="ts">
/**
 * The profile photo: the avatar with a camera badge that picks a new one,
 * and whatever the page puts beside it (the name and email) with a quiet
 * "Remove photo" under it.
 */
defineSlots<{ default?: () => unknown }>()

const api = useApi()
const toast = useToast()
const { user, displayName, avatarUrl, initials } = useAuth()

const input = useTemplateRef<HTMLInputElement>('input')
const uploading = ref(false)

// Browser-side mirror of the backend's limit, so an oversized file is rejected
// before it's uploaded rather than after
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

async function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }

  if (file.size > MAX_BYTES) {
    toast.add({
      title: 'Image is too large',
      description: 'Pick something under 5 MB.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
    return
  }

  uploading.value = true

  try {
    const body = new FormData()
    body.append('file', file)

    user.value = await api.post('/auth/me/avatar', body)
    toast.add({ title: 'Photo updated', icon: 'i-lucide-circle-check', color: 'success' })
  } catch (error) {
    toast.add({
      title: apiErrorMessage(error, 'Upload failed'),
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
  } finally {
    uploading.value = false
    // Reset so picking the same file again still fires `change`
    if (input.value) {
      input.value.value = ''
    }
  }
}

async function removeAvatar() {
  uploading.value = true

  try {
    user.value = await api.del('/auth/me/avatar')
    toast.add({ title: 'Photo removed', icon: 'i-lucide-circle-check', color: 'success' })
  } catch (error) {
    toast.add({
      title: apiErrorMessage(error, 'Could not remove the photo'),
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="relative shrink-0">
      <UAvatar
        :src="avatarUrl"
        :alt="displayName"
        :text="initials"
        :ui="{ root: 'size-16 bg-accented', fallback: 'font-rounded text-title3 text-toned' }"
      />
      <div
        v-if="uploading"
        class="absolute inset-0 flex items-center justify-center rounded-full bg-default/70"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-5 animate-spin text-primary"
        />
      </div>
      <UButton
        icon="i-lucide-camera"
        size="xs"
        color="neutral"
        variant="solid"
        square
        class="app-hit absolute -right-1 -bottom-1 rounded-full ring-2 ring-(--app-cell)"
        :disabled="uploading"
        aria-label="Upload a photo — JPG, PNG, WebP or GIF, up to 5 MB"
        @click="input?.click()"
      />
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <slot />
      <UButton
        v-if="user?.avatar_url"
        label="Remove photo"
        color="neutral"
        variant="link"
        size="sm"
        class="self-start px-0"
        :disabled="uploading"
        @click="removeAvatar"
      />
      <p
        v-else
        class="text-caption text-muted"
      >
        JPG, PNG, WebP or GIF, up to 5 MB.
      </p>
    </div>

    <input
      ref="input"
      type="file"
      :accept="ACCEPT"
      class="hidden"
      @change="onFileChange"
    >
  </div>
</template>
