<script setup lang="ts">
import type { ExportPreset } from '~/composables/useEating'
import { dayShort, presetRange } from '~/composables/useEating'

/**
 * The diary for a period, as a file: a PDF to print (a doctor, a coach) or
 * a CSV for a spreadsheet. Presets named after the calendar — today, this
 * week, last week, this month — or two dates picked by hand, checked here
 * before the API would refuse them.
 */

const open = defineModel<boolean>('open', { default: false })
useSheetHistory(open)

const { exportFile } = useEating()
const toast = useToast()
const saveFile = useSaveFile()

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

const exporting = ref(false)
type Period = ExportPreset | 'custom'

const PERIODS: { value: ExportPreset, label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This week' },
  { value: 'last-week', label: 'Last week' },
  { value: 'this-month', label: 'This month' }
]

/** What the backend will hand over in one file; past this it answers 400 */
const MAX_EXPORT_DAYS = 400

/** The presets, then two dates of one's own */
const CHOICES: { value: Period, label: string }[] = [...PERIODS, { value: 'custom', label: 'Pick the dates' }]

const today = useToday()
const period = ref<Period>('this-week')
const customFrom = ref('')
const customTo = ref('')

const range = computed<{ from: string, to: string }>(() =>
  period.value === 'custom'
    ? { from: customFrom.value, to: customTo.value }
    : presetRange(period.value, today.value))

// Custom opens on whatever period was showing, so the dates are already sane
// and only the edge that matters needs moving. Typed dates are left alone.
watch(period, (now, before) => {
  if (now !== 'custom' || before === 'custom' || (customFrom.value && customTo.value)) {
    return
  }
  const seed = presetRange(before, today.value)
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
        <!-- One of a few, iOS's way: a list with a checkmark on the chosen row -->
        <div
          class="app-card app-divide flex flex-col overflow-hidden"
          role="radiogroup"
          aria-label="Period"
        >
          <button
            v-for="entry in CHOICES"
            :key="entry.value"
            type="button"
            role="radio"
            class="flex min-h-11 items-center gap-3 px-4 text-left text-body text-default outline-none transition-colors duration-120 ease-soft focus-visible:bg-elevated active:bg-accented motion-reduce:transition-none"
            :aria-checked="period === entry.value"
            @click="period = entry.value"
          >
            <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
            <UIcon
              v-if="period === entry.value"
              name="i-lucide-check"
              class="size-5 shrink-0 text-primary"
            />
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
          class="flex min-h-11 items-center gap-2 px-4 text-subheadline text-error"
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
          class="app-card flex min-h-11 items-center gap-2 px-4 text-body text-default tabular-nums"
        >
          <UIcon
            name="i-lucide-calendar"
            class="size-4 shrink-0 text-muted"
          />
          {{ dayShort(range.from) }} → {{ dayShort(range.to) }}
          <span class="ml-auto text-subheadline text-muted">{{ rangeDays }} {{ rangeDays === 1 ? 'day' : 'days' }}</span>
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
