<script setup lang="ts">
/**
 * A number that counts to its new value instead of jumping there — the kcal
 * after a meal is added, an average when the period changes. Eased and in
 * step with the rings and bars filling (700 ms); under reduced motion it
 * simply shows the new value.
 */
const props = withDefaults(defineProps<{
  value: number
  /** How the number is written while it moves and when it lands */
  format?: (value: number) => string
  duration?: number
}>(), {
  format: (value: number) => String(Math.round(value)),
  duration: 700
})

const reduced = useReducedMotion()
const shown = ref(0)
let frame = 0

function ease(progress: number): number {
  return 1 - (1 - progress) ** 3
}

function run(from: number, to: number) {
  cancelAnimationFrame(frame)
  if (reduced.value || !Number.isFinite(from) || !Number.isFinite(to)) {
    shown.value = to
    return
  }
  const started = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - started) / props.duration)
    shown.value = from + (to - from) * ease(progress)
    if (progress < 1) {
      frame = requestAnimationFrame(step)
    }
  }
  frame = requestAnimationFrame(step)
}

// Arriving on screen it counts up from nothing; after that, from where it was
onMounted(() => run(0, props.value))
watch(() => props.value, next => run(shown.value, next))

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <span class="tabular-nums">{{ format(shown) }}</span>
</template>
