<script setup lang="ts">
import type { Activity, Goal, GoalEstimate, GoalProfile, Sex, Targets } from '~/composables/useEating'
import { MACRO_BARS, formatKcal, targetsFromEstimate } from '~/composables/useEating'

/**
 * The goal calculator, one question at a time: the body, how it moves, what
 * it is aiming for — then the day it comes to. The estimate comes from the
 * API (Mifflin–St Jeor × activity, a deficit or surplus for the goal), and
 * every number it gives can be overwritten before it is saved.
 *
 * Used by onboarding and by Settings; whoever hosts it saves what `finish`
 * hands back.
 */
const props = withDefaults(defineProps<{
  /** Answers given before, so the calculator reopens where it was left */
  initial?: GoalProfile | null
  finishLabel?: string
  saving?: boolean
}>(), {
  initial: null,
  finishLabel: 'Save my targets',
  saving: false
})

const emit = defineEmits<{ finish: [{ profile: GoalProfile, targets: Targets }] }>()

const { estimateGoals } = useEating()

type Step = 'body' | 'activity' | 'goal' | 'plan'
const STEPS: { value: Step, title: string, hint: string }[] = [
  { value: 'body', title: 'About you', hint: 'Only used to estimate what your body burns.' },
  { value: 'activity', title: 'How active is a usual week?', hint: 'Count the job as well as the training.' },
  { value: 'goal', title: 'What are you aiming for?', hint: 'You can change it any time in Settings.' },
  { value: 'plan', title: 'Your daily plan', hint: 'An estimate to start from — every number can be changed.' }
]

const SEXES: { value: Sex, label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Rather not say' }
]

const ACTIVITIES: { value: Activity, label: string, hint: string, icon: string }[] = [
  { value: 'sedentary', label: 'Mostly sitting', hint: 'Desk job, little exercise', icon: 'i-lucide-armchair' },
  { value: 'light', label: 'Lightly active', hint: 'Walks, or exercise 1–3 days a week', icon: 'i-lucide-footprints' },
  { value: 'moderate', label: 'Moderately active', hint: 'Exercise 3–5 days a week', icon: 'i-lucide-bike' },
  { value: 'active', label: 'Very active', hint: 'Hard exercise 6–7 days a week', icon: 'i-lucide-dumbbell' },
  { value: 'very_active', label: 'Extra active', hint: 'A physical job and training on top', icon: 'i-lucide-flame' }
]

const GOALS: { value: Goal, label: string, icon: string }[] = [
  { value: 'lose', label: 'Lose weight', icon: 'i-lucide-trending-down' },
  { value: 'maintain', label: 'Keep my weight', icon: 'i-lucide-equal' },
  { value: 'gain', label: 'Gain weight', icon: 'i-lucide-trending-up' }
]

const PACES: Record<Goal, { value: number, label: string }[]> = {
  lose: [
    { value: 0.25, label: '0.25 kg' },
    { value: 0.5, label: '0.5 kg' },
    { value: 0.75, label: '0.75 kg' },
    { value: 1, label: '1 kg' }
  ],
  maintain: [],
  gain: [
    { value: 0.25, label: '0.25 kg' },
    { value: 0.5, label: '0.5 kg' }
  ]
}

const thisYear = new Date().getFullYear()
const YOUNGEST = thisYear - 13

/** Number inputs hand back '' while empty; the form holds that as null */
const form = reactive({
  sex: (props.initial?.sex ?? null) as Sex | null,
  birth_year: (props.initial?.birth_year ?? null) as number | null,
  height_cm: (props.initial?.height_cm ?? null) as number | null,
  weight_kg: (props.initial?.weight_kg ?? null) as number | null,
  activity: (props.initial?.activity ?? null) as Activity | null,
  goal: (props.initial?.goal ?? null) as Goal | null,
  pace: props.initial?.pace ?? 0.5,
  protein_per_kg: (props.initial?.protein_per_kg ?? null) as number | null,
  fat_percent: props.initial?.fat_percent ?? 30
})

const step = ref<Step>('body')
const stepIndex = computed(() => STEPS.findIndex(entry => entry.value === step.value))
const current = computed(() => STEPS[stepIndex.value] ?? STEPS[0]!)

function numberOf(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return value === '' || value === null || value === undefined || !Number.isFinite(number) ? null : number
}

/** Said under the field, as soon as it is wrong — never after Continue */
const bodyProblems = computed(() => {
  const problems: Partial<Record<'birth_year' | 'height_cm' | 'weight_kg', string>> = {}
  const year = numberOf(form.birth_year)
  if (year !== null && (year < 1900 || year > YOUNGEST)) {
    problems.birth_year = year > YOUNGEST ? 'Targets here are for people aged 13 and over.' : 'Check the year.'
  }
  const height = numberOf(form.height_cm)
  if (height !== null && (height < 100 || height > 250)) {
    problems.height_cm = 'Between 100 and 250 cm.'
  }
  const weight = numberOf(form.weight_kg)
  if (weight !== null && (weight < 30 || weight > 350)) {
    problems.weight_kg = 'Between 30 and 350 kg.'
  }
  return problems
})

const canContinue = computed(() => {
  if (step.value === 'body') {
    return Boolean(form.sex && numberOf(form.birth_year) && numberOf(form.height_cm) && numberOf(form.weight_kg))
      && !Object.keys(bodyProblems.value).length
  }
  if (step.value === 'activity') {
    return form.activity !== null
  }
  if (step.value === 'goal') {
    return form.goal !== null
  }
  return estimate.value !== null
})

/** The answers as the API wants them — only ever read once they are complete */
function profile(): GoalProfile {
  return {
    sex: form.sex ?? 'other',
    birth_year: numberOf(form.birth_year) ?? 1990,
    height_cm: numberOf(form.height_cm) ?? 170,
    weight_kg: numberOf(form.weight_kg) ?? 70,
    activity: form.activity ?? 'light',
    goal: form.goal ?? 'maintain',
    pace: form.goal === 'maintain' ? 0 : form.pace,
    protein_per_kg: form.protein_per_kg,
    fat_percent: form.fat_percent
  }
}

function next() {
  if (!canContinue.value) {
    return
  }
  if (step.value === 'plan') {
    emit('finish', { profile: profile(), targets: { ...targets.value } })
    return
  }
  step.value = STEPS[stepIndex.value + 1]?.value ?? 'plan'
}

function back() {
  step.value = STEPS[Math.max(0, stepIndex.value - 1)]?.value ?? 'body'
}

function pickGoal(goal: Goal) {
  form.goal = goal
  // The pace on offer differs per direction; keep one that exists there
  const paces = PACES[goal].map(entry => entry.value)
  if (paces.length && !paces.includes(form.pace)) {
    form.pace = 0.5
  }
}

/** "≈ −550 kcal a day" — what a pace means, before the plan is worked out */
function paceKcal(pace: number): string {
  const kcal = Math.round((pace * 7700) / 7 / 10) * 10
  return `${form.goal === 'lose' ? '−' : '+'}${kcal} kcal a day`
}

// --- The plan ---------------------------------------------------------------

const estimate = ref<GoalEstimate | null>(null)
const estimating = ref(false)
const estimateError = ref<string | null>(null)
const targets = ref<Targets>({ target_kcal: null, target_protein: null, target_carbs: null, target_fat: null })
/** Typed over by hand — a new estimate then no longer replaces them */
const customised = ref(false)
const fineTune = ref(false)

let estimateTimer: ReturnType<typeof setTimeout> | null = null

async function runEstimate() {
  estimating.value = true
  estimateError.value = null
  try {
    estimate.value = await estimateGoals(profile())
    // The slider's starting point is whatever the goal defaults to
    if (form.protein_per_kg === null) {
      form.protein_per_kg = estimate.value.protein_per_kg
    }
    if (!customised.value) {
      targets.value = targetsFromEstimate(estimate.value)
    }
  } catch (error) {
    estimateError.value = apiErrorMessage(error)
  } finally {
    estimating.value = false
  }
}

function scheduleEstimate() {
  if (estimateTimer) {
    clearTimeout(estimateTimer)
  }
  estimateTimer = setTimeout(() => void runEstimate(), 200)
}

watch(step, (value) => {
  if (value === 'plan') {
    void runEstimate()
  }
})

watch(() => [form.protein_per_kg, form.fat_percent], () => {
  if (step.value === 'plan' && estimate.value) {
    scheduleEstimate()
  }
})

function onTargetsTyped() {
  customised.value = true
}

function resetToEstimate() {
  customised.value = false
  if (estimate.value) {
    targets.value = targetsFromEstimate(estimate.value)
  }
}

/** Each macro's share of the day's energy, so the split reads at a glance */
const macroRows = computed(() => {
  const kcal = targets.value.target_kcal || 0
  return MACRO_BARS.map((bar) => {
    const key = `target_${bar.key}` as const
    const grams = targets.value[key] ?? 0
    const energy = grams * (bar.key === 'fat' ? 9 : 4)
    return { ...bar, grams, share: kcal ? Math.round((energy / kcal) * 100) : 0 }
  })
})

const proteinSlider = computed({
  get: () => form.protein_per_kg ?? 1.6,
  set: (value: number) => {
    form.protein_per_kg = Math.round(value * 10) / 10
  }
})

const fatSlider = computed({
  get: () => form.fat_percent,
  set: (value: number) => {
    form.fat_percent = value
  }
})

/** A tile among a few to choose from — the chosen one picked out in the brand */
const CHOICE = 'app-press flex w-full items-center gap-3 rounded-tile border px-3.5 py-3 text-left outline-none transition-colors duration-200 ease-soft focus-visible:ring-2 focus-visible:ring-primary'
const CHOSEN = 'border-primary/50 bg-primary/8'
const UNCHOSEN = 'border-default bg-default active:bg-elevated/70'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <!-- Where in the questions: one dot per step, the current one drawn out -->
      <div
        class="flex items-center gap-1.5"
        role="progressbar"
        :aria-valuenow="stepIndex + 1"
        aria-valuemin="1"
        :aria-valuemax="STEPS.length"
        :aria-label="`Step ${stepIndex + 1} of ${STEPS.length}`"
      >
        <span
          v-for="(entry, index) in STEPS"
          :key="entry.value"
          class="h-1.5 rounded-full transition-[width,background-color] duration-300 ease-soft motion-reduce:transition-none"
          :class="index === stepIndex ? 'w-6 bg-primary' : index < stepIndex ? 'w-1.5 bg-primary/60' : 'w-1.5 bg-accented'"
        />
        <span class="ml-1.5 text-caption font-semibold text-muted tabular-nums">{{ stepIndex + 1 }} of {{ STEPS.length }}</span>
      </div>
      <h2 class="text-xl font-semibold text-highlighted">
        {{ current.title }}
      </h2>
      <p class="-mt-1 text-sm text-muted">
        {{ current.hint }}
      </p>
    </div>

    <Transition
      name="panel"
      mode="out-in"
    >
      <!-- 1 · The body -->
      <div
        v-if="step === 'body'"
        key="body"
        class="flex flex-col gap-4"
      >
        <UFormField
          label="Sex"
          hint="for the formula"
        >
          <div
            class="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Sex"
          >
            <button
              v-for="option in SEXES"
              :key="option.value"
              type="button"
              role="radio"
              class="app-chip h-11 px-4"
              :aria-checked="form.sex === option.value"
              @click="form.sex = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </UFormField>

        <UFormField
          label="Year of birth"
          :error="bodyProblems.birth_year"
        >
          <UInput
            v-model.number="form.birth_year"
            type="number"
            inputmode="numeric"
            :min="1900"
            :max="YOUNGEST"
            placeholder="1990"
            class="w-full"
            :ui="{ base: 'tabular-nums' }"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="Height"
            :error="bodyProblems.height_cm"
          >
            <DecimalInput
              v-model="form.height_cm"
              placeholder="170"
              class="w-full"
              :ui="{ base: 'tabular-nums', trailing: 'pointer-events-none' }"
            >
              <template #trailing>
                <span class="text-sm text-dimmed">cm</span>
              </template>
            </DecimalInput>
          </UFormField>
          <UFormField
            label="Weight"
            :error="bodyProblems.weight_kg"
          >
            <DecimalInput
              v-model="form.weight_kg"
              placeholder="70"
              class="w-full"
              :ui="{ base: 'tabular-nums', trailing: 'pointer-events-none' }"
            >
              <template #trailing>
                <span class="text-sm text-dimmed">kg</span>
              </template>
            </DecimalInput>
          </UFormField>
        </div>
      </div>

      <!-- 2 · How it moves -->
      <ul
        v-else-if="step === 'activity'"
        key="activity"
        class="flex flex-col gap-2"
        role="radiogroup"
        aria-label="Activity level"
      >
        <li
          v-for="option in ACTIVITIES"
          :key="option.value"
        >
          <button
            type="button"
            role="radio"
            :aria-checked="form.activity === option.value"
            :class="[CHOICE, form.activity === option.value ? CHOSEN : UNCHOSEN]"
            @click="form.activity = option.value"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ease-soft"
              :class="form.activity === option.value ? 'bg-primary text-white dark:text-oat-950' : 'bg-primary/10 text-primary'"
            >
              <UIcon
                :name="option.icon"
                class="size-5"
              />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-body font-semibold text-highlighted">{{ option.label }}</span>
              <span class="text-xs text-muted">{{ option.hint }}</span>
            </span>
            <UIcon
              :name="form.activity === option.value ? 'i-lucide-circle-check' : 'i-lucide-circle'"
              class="size-5 shrink-0"
              :class="form.activity === option.value ? 'text-primary' : 'text-dimmed'"
            />
          </button>
        </li>
      </ul>

      <!-- 3 · The goal, and how fast -->
      <div
        v-else-if="step === 'goal'"
        key="goal"
        class="flex flex-col gap-4"
      >
        <div
          class="grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label="Goal"
        >
          <button
            v-for="option in GOALS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="form.goal === option.value"
            class="app-press flex flex-col items-center gap-2.5 rounded-tile border px-2 py-4 text-center outline-none transition-colors duration-200 ease-soft focus-visible:ring-2 focus-visible:ring-primary"
            :class="form.goal === option.value ? CHOSEN : UNCHOSEN"
            @click="pickGoal(option.value)"
          >
            <span
              class="flex size-11 items-center justify-center rounded-full transition-colors duration-200 ease-soft"
              :class="form.goal === option.value ? 'bg-primary text-white dark:text-oat-950' : 'bg-primary/10 text-primary'"
            >
              <UIcon
                :name="option.icon"
                class="size-6"
              />
            </span>
            <span class="text-sm font-semibold text-highlighted">{{ option.label }}</span>
          </button>
        </div>

        <UFormField
          v-if="form.goal && PACES[form.goal].length"
          label="How fast, per week"
          :hint="paceKcal(form.pace)"
        >
          <ShellSegmented
            v-model="form.pace"
            label="How fast, per week"
            :options="PACES[form.goal]"
          />
        </UFormField>
        <p
          v-if="form.goal === 'lose' && form.pace >= 1"
          class="flex items-start gap-2 rounded-tile bg-warning/10 px-3.5 py-3 text-sm text-default"
        >
          <UIcon
            name="i-lucide-info"
            class="mt-0.5 size-4 shrink-0 text-warning"
          />
          A kilo a week is a lot for most people — 0.5 kg is easier to keep up.
        </p>
      </div>

      <!-- 4 · The plan -->
      <div
        v-else
        key="plan"
        class="flex flex-col gap-4"
      >
        <UAlert
          v-if="estimateError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="estimateError"
        />

        <div
          v-if="!estimate"
          class="flex flex-col gap-3"
        >
          <span class="app-shimmer h-12 w-48 rounded-xl" />
          <ShellSkeleton
            variant="text"
            :count="2"
          />
          <ShellSkeleton
            variant="tiles"
            :count="3"
          />
        </div>

        <template v-else>
          <!-- The answer, big: the day it all comes to -->
          <div class="flex flex-col gap-1.5 rounded-card bg-linear-to-br from-primary-50 via-default to-default p-4 ring-1 ring-primary-100 dark:from-primary-950/60 dark:ring-primary-900/60">
            <span class="app-eyebrow">Your day</span>
            <span class="flex items-baseline gap-2">
              <span
                class="text-hero text-highlighted tabular-nums transition-opacity duration-200 ease-soft"
                :class="estimating && 'opacity-60'"
              >{{ formatKcal(targets.target_kcal ?? estimate.kcal) }}</span>
              <span class="text-sm font-semibold text-muted">kcal</span>
            </span>
            <span class="text-xs text-muted tabular-nums">
              About {{ formatKcal(estimate.bmr) }} at rest · {{ formatKcal(estimate.maintenance) }} on a usual day<template v-if="estimate.daily_change">
                · {{ estimate.daily_change > 0 ? '+' : '−' }}{{ formatKcal(Math.abs(estimate.daily_change)) }} for your goal
              </template>
            </span>
          </div>

          <UAlert
            v-if="estimate.floored"
            color="warning"
            variant="subtle"
            icon="i-lucide-shield-alert"
            title="Raised to a safe minimum"
            :description="`Your goal asked for less than ${formatKcal(estimate.kcal)} kcal. Going lower is best done with a professional.`"
          />

          <div class="grid grid-cols-3 gap-2">
            <ShellStatTile
              v-for="row in macroRows"
              :key="row.key"
              :label="row.label"
              :macro="row.key"
              :value="row.grams"
              unit="g"
              :hint="`${row.share}% of kcal`"
              tone="well"
            />
          </div>

          <div class="flex flex-col gap-4 rounded-tile border border-default p-4">
            <UFormField
              label="Protein"
              :hint="`${proteinSlider.toFixed(1)} g per kg`"
              :ui="{ hint: 'tabular-nums' }"
            >
              <USlider
                v-model="proteinSlider"
                :min="1.2"
                :max="2.6"
                :step="0.1"
                :disabled="customised"
                class="py-2"
                aria-label="Protein per kilogram of bodyweight"
              />
            </UFormField>
            <UFormField
              label="Fat"
              :hint="`${fatSlider}% of kcal`"
              :ui="{ hint: 'tabular-nums' }"
            >
              <USlider
                v-model="fatSlider"
                :min="20"
                :max="40"
                :step="5"
                :disabled="customised"
                class="py-2"
                aria-label="Fat as a share of the day's energy"
              />
            </UFormField>
            <p class="text-caption text-muted">
              Carbs fill whatever is left.
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <UButton
              :label="fineTune ? 'Hide the exact numbers' : 'Type the exact numbers'"
              :icon="fineTune ? 'i-lucide-chevron-up' : 'i-lucide-pencil-line'"
              size="sm"
              color="neutral"
              variant="ghost"
              class="self-start"
              @click="fineTune = !fineTune"
            />
            <template v-if="fineTune">
              <TargetsFields
                v-model="targets"
                @update:model-value="onTargetsTyped"
              />
              <UButton
                v-if="customised"
                label="Back to the estimate"
                icon="i-lucide-rotate-ccw"
                size="sm"
                color="neutral"
                variant="soft"
                class="self-start"
                @click="resetToEstimate"
              />
            </template>
          </div>

          <p class="text-caption text-dimmed">
            Estimated with the Mifflin–St Jeor formula. It is a starting point, not medical advice —
            see how your weight moves over a few weeks and adjust.
          </p>
        </template>
      </div>
    </Transition>

    <div class="flex items-center gap-2">
      <UButton
        v-if="stepIndex > 0"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="soft"
        size="lg"
        square
        aria-label="Back"
        :disabled="saving"
        @click="back"
      />
      <UButton
        :label="step === 'plan' ? finishLabel : 'Continue'"
        :trailing-icon="step === 'plan' ? undefined : 'i-lucide-arrow-right'"
        size="lg"
        class="flex-1 justify-center"
        :loading="saving || (step === 'plan' && estimating && !estimate)"
        :disabled="!canContinue"
        @click="next"
      />
    </div>
  </div>
</template>
