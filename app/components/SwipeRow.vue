<script setup lang="ts">
/**
 * A row that answers a sideways swipe, the way a phone's mail app does:
 * pull left past the line to delete, pull right to duplicate. The action
 * shows under the row as it moves, a buzz marks the point of no return, and
 * a swipe that stops short springs back. Vertical scrolling is left to the
 * browser (`touch-action: pan-y`), and nothing here is the only way to the
 * action — the row's menu has the same ones, for mouse and keyboard.
 */
const props = withDefaults(defineProps<{
  /** Swiping left: the destructive one */
  left?: { label: string, icon: string } | null
  /** Swiping right */
  right?: { label: string, icon: string } | null
  disabled?: boolean
}>(), {
  left: null,
  right: null,
  disabled: false
})

const emit = defineEmits<{
  swipeLeft: []
  swipeRight: []
}>()

const reduced = useReducedMotion()
const haptics = useHaptics()

const row = ref<HTMLElement | null>(null)
const offset = ref(0)
const settling = ref(false)

/** Past this share of the row's width, letting go does it */
const COMMIT_SHARE = 0.35
/** How far a finger must travel before the gesture is read at all */
const SLOP = 8

let startX = 0
let startY = 0
let pointer: number | null = null
let direction: 'none' | 'horizontal' | 'vertical' = 'none'
let armed = false
let swallowClick = false

function width(): number {
  return row.value?.clientWidth || 320
}

function onDown(event: PointerEvent) {
  if (props.disabled || settling.value || (event.pointerType === 'mouse' && event.button !== 0)) {
    return
  }
  // Fields inside the row keep their own gestures (selecting text, sliders)
  if ((event.target as HTMLElement).closest('input, textarea, select, [data-no-swipe]')) {
    return
  }
  pointer = event.pointerId
  startX = event.clientX
  startY = event.clientY
  direction = 'none'
  armed = false
}

function onMove(event: PointerEvent) {
  if (event.pointerId !== pointer) {
    return
  }
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (direction === 'none') {
    if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) {
      return
    }
    direction = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'horizontal' : 'vertical'
    if (direction === 'horizontal') {
      row.value?.setPointerCapture(event.pointerId)
    }
  }
  if (direction !== 'horizontal') {
    return
  }
  // Only towards a side that has an action; a little give the other way
  const allowed = (dx < 0 && props.left) || (dx > 0 && props.right)
  offset.value = allowed ? dx : dx * 0.15
  const past = Math.abs(offset.value) > width() * COMMIT_SHARE
  if (past !== armed) {
    armed = past
    if (past) {
      haptics.tap()
    }
  }
}

async function settle(to: number) {
  settling.value = true
  offset.value = to
  await new Promise(resolve => setTimeout(resolve, reduced.value ? 0 : 220))
  settling.value = false
}

async function onUp(event: PointerEvent) {
  if (event.pointerId !== pointer) {
    return
  }
  pointer = null
  if (direction !== 'horizontal') {
    return
  }
  swallowClick = true
  const goingLeft = offset.value < 0
  if (armed && goingLeft && props.left) {
    haptics.warn()
    // Slides out, then the page removes it (and offers Undo)
    await settle(-width())
    emit('swipeLeft')
    offset.value = 0
    return
  }
  if (armed && !goingLeft && props.right) {
    haptics.success()
    await settle(0)
    emit('swipeRight')
    return
  }
  await settle(0)
}

function onCancel() {
  pointer = null
  if (direction === 'horizontal') {
    void settle(0)
  }
}

/** The click that ends a swipe is not a tap on the row */
function onClickCapture(event: MouseEvent) {
  if (swallowClick) {
    swallowClick = false
    event.stopPropagation()
    event.preventDefault()
  }
}

const showing = computed(() => (offset.value < 0 ? 'left' : offset.value > 0 ? 'right' : null))
const progress = computed(() => Math.min(1, Math.abs(offset.value) / (width() * COMMIT_SHARE)))
</script>

<template>
  <div
    class="relative overflow-hidden"
    data-swipe-row
  >
    <!-- What the swipe will do, revealed underneath -->
    <div
      v-if="showing"
      class="absolute inset-0 flex items-center px-5 text-subheadline font-semibold text-inverted"
      :class="showing === 'left'
        ? 'justify-end bg-error'
        : 'justify-start bg-primary'"
      aria-hidden="true"
    >
      <span
        class="flex items-center gap-1.5 transition-transform duration-120 ease-soft"
        :style="{ transform: `scale(${0.85 + progress * 0.15})`, opacity: 0.4 + progress * 0.6 }"
      >
        <UIcon
          :name="(showing === 'left' ? left?.icon : right?.icon) ?? ''"
          class="size-4"
        />
        {{ showing === 'left' ? left?.label : right?.label }}
      </span>
    </div>

    <div
      ref="row"
      class="relative bg-cell"
      :class="settling && !reduced ? 'transition-transform duration-200 ease-soft' : ''"
      :style="{ transform: offset ? `translateX(${offset}px)` : undefined, touchAction: 'pan-y' }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onCancel"
      @click.capture="onClickCapture"
    >
      <slot />
    </div>
  </div>
</template>
