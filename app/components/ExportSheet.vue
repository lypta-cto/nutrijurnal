<script setup lang="ts">
import { dayShort, shiftDay } from '~/composables/useEating'

/**
 * The diary for a period, as a file: a PDF to print (a doctor, a coach) or
 * a CSV for a spreadsheet. Presets around the day on screen, or two dates
 * picked by hand — checked here before the API would refuse them.
 */
const props = defineProps<{
  /** The day the presets are counted back from */
  day: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { exportFile } = useEating()
const toast = useToast()
const saveFile = useSaveFile()

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

const exporting = ref(false)
type Period = 'day' | 'week' | 'month' | '30d' | 'custom'
type Preset = Exclude<Period, 'custom'>

const PERIODS: { value: Preset, label: string }[] = [
  { value: 'day', label: 'This day' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' }
]

/** What the backend will hand over in one file; past this it answers 400 */
const MAX_EXPORT_DAYS = 400

const period = ref<Period>('week')
const customFrom = ref('')
const customTo = ref('')

function presetRange(which: Preset, to: string): { from: string, to: string } {
  if (which === 'day') {
    return { from: to, to }
  }
  if (which === 'week') {
    return { from: shiftDay(to, -6), to }
  }
  if (which === '30d') {
    return { from: shiftDay(to, -29), to }
  }
  return { from: `${to.slice(0, 7)}-01`, to }
}

const range = computed<{ from: string, to: string }>(() =>
  period.value === 'custom'
    ? { from: customFrom.value, to: customTo.value }
    : presetRange(period.value, props.day))

// Custom opens on whatever period was showing, so the dates are already sane
// and only the edge that matters needs moving. Typed dates are left alone.
watch(period, (now, before) => {
  if (now !== 'custom' || before === 'custom' || (customFrom.value && customTo.value)) {
    return
  }
  const seed = presetRange(before, props.day)
  customFrom.value = customFrom.value || seed.from
  customTo.value = customTo.value || seed.to
})

/** Both ends counted, the way a person counts days off a calendar */
const rangeDays = computed(() => {
  const { from, to } = range.value
  if (!from || !to) {
    return null
  }
  const span = new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()
  return Math.round(span / 86_400_000) + 1
})

/** Said before the download, not after a 400 comes back */
const rangeProblem = computed<string | null>(() => {
  if (period.value !== 'custom') {
    return null
  }
  if (!customFrom.value || !customTo.value) {
    return 'Pick both dates.'
  }
  const days = rangeDays.value
  if (days === null || days < 1) {
    return 'The first date is after the last one.'
  }
  if (days > MAX_EXPORT_DAYS) {
    return `That is ${days} days — ${MAX_EXPORT_DAYS} is the most in one file.`
  }
  return null
})

async function download(format: 'pdf' | 'csv') {
  if (rangeProblem.value || exporting.value) {
    return
  }
  exporting.value = true
  try {
    const blob = await exportFile(range.value.from, range.value.to, format)
    await saveFile(blob, `nutrijurnal_${range.value.from}_${range.value.to}.${format}`)
    open.value = false
  } catch (error) {
    fail(error)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    :ui="SHEET_UI"
    title="Export the diary"
    description="A period, day by day — a PDF to print or a CSV for a spreadsheet."
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div
          class="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Period"
        >
          <button
            v-for="entry in PERIODS"
            :key="entry.value"
            type="button"
            role="radio"
            class="app-chip h-11"
            :aria-checked="period === entry.value"
            @click="period = entry.value"
          >
            {{ entry.label }}
          </button>
          <button
            type="button"
            role="radio"
            class="app-chip col-span-2 h-11"
            :aria-checked="period === 'custom'"
            @click="period = 'custom'"
          >
            <UIcon
              name="i-lucide-calendar-range"
              class="size-4"
            />
            Pick the dates
          </button>
        </div>

        <div
          v-if="period === 'custom'"
          class="grid grid-cols-2 gap-3"
        >
          <UFormField label="From">
            <input
              v-model="customFrom"
              type="date"
              :max="customTo || undefined"
              class="app-field"
              aria-label="First day of the export"
            >
          </UFormField>
          <UFormField label="To">
            <input
              v-model="customTo"
              type="date"
              :min="customFrom || undefined"
              class="app-field"
              aria-label="Last day of the export"
            >
          </UFormField>
        </div>

        <p
          v-if="rangeProblem"
          class="flex items-center gap-2 rounded-tile bg-error/10 px-3.5 py-2.5 text-sm text-error"
          role="alert"
        >
          <UIcon
            name="i-lucide-circle-alert"
            class="size-4 shrink-0"
          />
          {{ rangeProblem }}
        </p>
        <p
          v-else
          class="flex items-center gap-2 rounded-tile bg-elevated/70 px-3.5 py-2.5 text-sm text-default tabular-nums"
        >
          <UIcon
            name="i-lucide-calendar"
            class="size-4 shrink-0 text-muted"
          />
          {{ dayShort(range.from) }} → {{ dayShort(range.to) }}
          <span class="ml-auto text-muted">{{ rangeDays }} {{ rangeDays === 1 ? 'day' : 'days' }}</span>
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full gap-2">
        <UButton
          label="PDF"
          icon="i-lucide-file-down"
          size="lg"
          class="flex-1 justify-center"
          :loading="exporting"
          :disabled="Boolean(rangeProblem)"
          @click="download('pdf')"
        />
        <UButton
          label="CSV"
          icon="i-lucide-table"
          color="neutral"
          variant="soft"
          size="lg"
          class="flex-1 justify-center"
          :loading="exporting"
          :disabled="Boolean(rangeProblem)"
          @click="download('csv')"
        />
      </div>
    </template>
  </UDrawer>
</template>
