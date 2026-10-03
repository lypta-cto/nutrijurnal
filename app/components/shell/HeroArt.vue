<script setup lang="ts">
/**
 * The welcome illustration on the auth screens: a bowl of good things in the
 * morning sun — leaves fanning out, a tomato, half an egg, cucumber,
 * blueberries — with sparkles in the diary's macro colours around it. Drawn
 * here in SVG from the palette, so it follows the theme and costs no request.
 * Decorative only; screen readers skip it.
 */
interface Leaf {
  x: number
  y: number
  angle: number
  length: number
  width: number
  fill: string
}

// Each leaf grows from inside the bowl; listed back to front
const LEAVES: Leaf[] = [
  { x: 128, y: 130, angle: -170, length: 54, width: 14, fill: 'fill-basil-500 dark:fill-basil-700' },
  { x: 236, y: 130, angle: -12, length: 50, width: 13, fill: 'fill-basil-300 dark:fill-basil-600' },
  { x: 150, y: 128, angle: -140, length: 74, width: 19, fill: 'fill-basil-400 dark:fill-basil-600' },
  { x: 214, y: 128, angle: -38, length: 70, width: 18, fill: 'fill-basil-400 dark:fill-basil-600' },
  { x: 168, y: 126, angle: -106, length: 80, width: 20, fill: 'fill-basil-300 dark:fill-basil-500' },
  { x: 192, y: 126, angle: -70, length: 82, width: 21, fill: 'fill-basil-500 dark:fill-basil-500' }
]

function almond(length: number, width: number): string {
  const near = length * 0.25
  const far = length * 0.75
  return `M0 0C${near} ${-width} ${far} ${-width} ${length} 0C${far} ${width} ${near} ${width} 0 0Z`
}

/** A four-pointed sparkle centred on (x, y) */
function sparkle(x: number, y: number, size: number): string {
  const pinch = size * 0.22
  return [
    `M${x} ${y - size}`,
    `C${x} ${y - pinch} ${x + pinch} ${y} ${x + size} ${y}`,
    `C${x + pinch} ${y} ${x} ${y + pinch} ${x} ${y + size}`,
    `C${x} ${y + pinch} ${x - pinch} ${y} ${x - size} ${y}`,
    `C${x - pinch} ${y} ${x} ${y - pinch} ${x} ${y - size}Z`
  ].join('')
}

/** Points spaced round a circle — seeds in a tomato or a cucumber slice */
function around(cx: number, cy: number, radius: number, count: number, turn = 0) {
  return Array.from({ length: count }, (_, index) => {
    const angle = turn + (index * 360) / count
    const rad = (angle * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad), angle }
  })
}

const BERRIES = [
  { x: 110, y: 131, r: 6.5 },
  { x: 121, y: 137, r: 6 },
  { x: 252, y: 134, r: 6.5 },
  { x: 263, y: 128, r: 5.5 }
]

const tomatoSeeds = around(140, 126, 8.5, 6, 15)
const cucumberSeeds = around(226, 127, 6, 6)

// The bowl's front, reused as a clip so its stripes stay inside it
const BOWL = 'M72 134A108 66 0 0 0 288 134Z'
const clipId = useId()
</script>

<template>
  <svg
    viewBox="0 0 360 226"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="clipId">
        <path :d="BOWL" />
      </clipPath>
    </defs>

    <!-- Morning sun -->
    <circle
      cx="180"
      cy="116"
      r="104"
      class="fill-clay-100/70 dark:fill-basil-950/50"
    />
    <circle
      cx="180"
      cy="116"
      r="76"
      class="fill-clay-50 dark:fill-oat-900/70"
    />

    <!-- Shadow on the table, and the bowl's foot -->
    <ellipse
      cx="180"
      cy="216"
      rx="84"
      ry="7"
      class="fill-oat-950/8 dark:fill-black/40"
    />
    <rect
      x="148"
      y="192"
      width="64"
      height="14"
      rx="6"
      class="fill-oat-200 dark:fill-oat-700"
    />

    <!-- Inside of the bowl -->
    <ellipse
      cx="180"
      cy="134"
      rx="108"
      ry="18"
      class="fill-oat-100 dark:fill-oat-800"
    />

    <g
      v-for="(leaf, index) in LEAVES"
      :key="index"
      :transform="`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle})`"
    >
      <path
        :d="almond(leaf.length, leaf.width)"
        :class="leaf.fill"
      />
      <path
        :d="`M${leaf.length * 0.1} 0L${leaf.length * 0.82} 0`"
        stroke-width="1.6"
        stroke-linecap="round"
        class="stroke-basil-700/35 dark:stroke-basil-950/50"
      />
    </g>

    <!-- Tomato -->
    <circle
      cx="140"
      cy="126"
      r="19"
      class="fill-clay-400"
    />
    <circle
      cx="140"
      cy="126"
      r="14.5"
      class="fill-clay-300"
    />
    <circle
      cx="140"
      cy="126"
      r="3.5"
      class="fill-clay-200"
    />
    <ellipse
      v-for="(seed, index) in tomatoSeeds"
      :key="`t${index}`"
      :cx="seed.x"
      :cy="seed.y"
      rx="2.4"
      ry="1.4"
      :transform="`rotate(${seed.angle} ${seed.x} ${seed.y})`"
      class="fill-clay-50"
    />

    <!-- Half an egg -->
    <ellipse
      cx="184"
      cy="120"
      rx="23"
      ry="16.5"
      class="fill-oat-50 dark:fill-oat-100"
    />
    <circle
      cx="185"
      cy="122"
      r="10"
      class="fill-amber-400"
    />
    <circle
      cx="181.5"
      cy="118.5"
      r="3"
      class="fill-amber-200"
    />

    <!-- Cucumber -->
    <circle
      cx="226"
      cy="127"
      r="16"
      class="fill-basil-500"
    />
    <circle
      cx="226"
      cy="127"
      r="12.5"
      class="fill-basil-100 dark:fill-basil-200"
    />
    <ellipse
      v-for="(seed, index) in cucumberSeeds"
      :key="`c${index}`"
      :cx="seed.x"
      :cy="seed.y"
      rx="1.8"
      ry="1"
      :transform="`rotate(${seed.angle} ${seed.x} ${seed.y})`"
      class="fill-basil-300"
    />

    <!-- Blueberries -->
    <g
      v-for="(berry, index) in BERRIES"
      :key="`b${index}`"
    >
      <circle
        :cx="berry.x"
        :cy="berry.y"
        :r="berry.r"
        class="fill-violet-500 dark:fill-violet-400"
      />
      <circle
        :cx="berry.x - 2"
        :cy="berry.y - 2"
        r="1.6"
        class="fill-violet-300 dark:fill-violet-200"
      />
    </g>

    <!-- The bowl's front, with its stripes -->
    <path
      :d="BOWL"
      stroke-width="1.5"
      class="fill-white stroke-oat-200 dark:fill-oat-800 dark:stroke-oat-700"
    />
    <g :clip-path="`url(#${clipId})`">
      <ellipse
        cx="214"
        cy="204"
        rx="96"
        ry="36"
        class="fill-oat-950/4 dark:fill-black/20"
      />
      <rect
        x="60"
        y="147"
        width="240"
        height="8"
        class="fill-primary-500 dark:fill-primary-400"
      />
      <rect
        x="60"
        y="160"
        width="240"
        height="3"
        class="fill-primary-500/45 dark:fill-primary-400/45"
      />
    </g>
    <path
      d="M72 134A108 18 0 0 0 288 134"
      stroke-width="3"
      class="stroke-oat-200 dark:stroke-oat-700"
    />

    <!-- Sparkles in the macro colours: protein, carbs, fat, and the day itself -->
    <path
      :d="sparkle(62, 70, 10)"
      class="fill-protein"
    />
    <path
      :d="sparkle(302, 56, 8)"
      class="fill-carbs"
    />
    <path
      :d="sparkle(314, 142, 6.5)"
      class="fill-fat"
    />
    <circle
      cx="88"
      cy="152"
      r="3.5"
      class="fill-kcal"
    />
    <circle
      cx="278"
      cy="98"
      r="2.5"
      class="fill-protein"
    />
    <circle
      cx="50"
      cy="118"
      r="2"
      class="fill-fat"
    />
    <circle
      cx="252"
      cy="38"
      r="2.5"
      class="fill-kcal"
    />
  </svg>
</template>
