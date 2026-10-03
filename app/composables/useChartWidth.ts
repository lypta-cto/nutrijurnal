import type { Ref } from 'vue'

/** One macro in the energy split */
export interface SplitPart {
  key: string
  label: string
  grams: number
  /** kcal per gram: 4 for protein and carbs, 9 for fat */
  energy: number
  color: string
  /** The target's grams, for the share it was meant to be */
  goal?: number | null
}

/** One day on a chart */
export interface ChartPoint {
  key: string
  /** Under the axis — shown only where there is room */
  label: string
  /** The tooltip's heading — "Mon 21 Sep" */
  title: string
  /** Null where nothing was logged: no mark, and "—" in the tooltip */
  value: number | null
  /** A second line in the tooltip — "of 2 300 kcal" */
  detail?: string
}

/**
 * How wide a chart has to draw itself, in pixels. Charts draw in real pixels
 * rather than a stretched viewBox, so text and 2 px lines stay crisp at any
 * width — this follows the container as it resizes.
 */
export function useChartWidth(element: Ref<HTMLElement | null>, fallback = 320) {
  const width = ref(fallback)
  let observer: ResizeObserver | null = null

  onMounted(() => {
    if (!element.value) {
      return
    }
    width.value = element.value.clientWidth || fallback
    observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured) {
        width.value = measured
      }
    })
    observer.observe(element.value)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return width
}

/** Round, readable tick values: steps of 1, 2 or 5 times a power of ten */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (!(max > min)) {
    return [min]
  }
  const rough = (max - min) / count
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * power).find(value => value >= rough) ?? rough
  const first = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let value = first; value <= max + step * 1e-9; value += step) {
    ticks.push(Number(value.toFixed(6)))
  }
  return ticks
}
