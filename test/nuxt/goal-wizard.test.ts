import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import type { GoalEstimate, GoalProfile } from '~/composables/useEating'
import GoalWizard from '~/components/GoalWizard.vue'

const THIN = ' '

const BODY: GoalProfile = {
  sex: 'female',
  birth_year: 1996,
  height_cm: 165,
  weight_kg: 60,
  activity: 'sedentary',
  goal: 'maintain',
  pace: 0.5,
  protein_per_kg: null,
  fat_percent: 30
}

const ESTIMATE: GoalEstimate = {
  age: 30,
  bmr: 1320,
  maintenance: 1584,
  kcal: 1580,
  protein: 96,
  carbs: 180,
  fat: 53,
  daily_change: -4,
  protein_per_kg: 1.6,
  fat_percent: 30,
  floored: false
}

/** The calculator's answer (or FastAPI's refusal), and every set of answers it was asked about */
function estimates(answer: GoalEstimate | { status: number, detail: string } = ESTIMATE) {
  const asked: GoalProfile[] = []
  registerEndpoint('/api/v1/eating/goals/estimate', {
    method: 'POST',
    handler: async (event) => {
      asked.push(await readBody(event))
      if ('status' in answer) {
        setResponseStatus(event, answer.status)
        return { detail: answer.detail }
      }
      return answer
    }
  })
  return asked
}

function button(wrapper: VueWrapper | DOMWrapper<Element>, label: string) {
  const found = wrapper.findAll('button').find(candidate => candidate.text().trim() === label || candidate.attributes('aria-label') === label)
  if (!found) {
    throw new Error(`No "${label}" button among: ${wrapper.findAll('button').map(candidate => candidate.text().trim()).join(' | ')}`)
  }
  return found
}

async function toThePlan(wizard: VueWrapper) {
  for (let step = 0; step < 3; step += 1) {
    await button(wizard, 'Continue').trigger('click')
    await flushPromises()
  }
}

describe('the goal calculator', () => {
  it('will not go on until the body is described, and says what is wrong as it is typed', async () => {
    const wizard = await mountSuspended(GoalWizard)
    expect(button(wizard, 'Continue').attributes('disabled')).toBeDefined()

    await button(wizard, 'Female').trigger('click')
    const [year, height, weight] = wizard.findAll('input')
    await year!.setValue(new Date().getFullYear() - 8)
    await height!.setValue(130)
    await weight!.setValue(28)

    expect(wizard.text()).toContain('Targets here are for people aged 13 and over.')
    expect(wizard.text()).toContain('Between 30 and 350 kg.')
    expect(button(wizard, 'Continue').attributes('disabled')).toBeDefined()

    await year!.setValue(1996)
    await height!.setValue(165)
    await weight!.setValue(60)

    expect(wizard.text()).not.toContain('Targets here are for people aged 13')
    expect(button(wizard, 'Continue').attributes('disabled')).toBeUndefined()
  })

  it('asks for the plan with no pace while maintaining and saves the estimate as the targets', async () => {
    const asked = estimates()
    const wizard = await mountSuspended(GoalWizard, { props: { initial: { ...BODY } } })

    await toThePlan(wizard)

    await vi.waitFor(() => expect(wizard.text()).toContain(`1${THIN}580`))
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ sex: 'female', birth_year: 1996, height_cm: 165, weight_kg: 60, goal: 'maintain', pace: 0 })

    await button(wizard, 'Save my targets').trigger('click')

    const finished = wizard.emitted('finish')?.[0]?.[0] as { profile: GoalProfile, targets: Record<string, number> }
    expect(finished.targets).toEqual({ target_kcal: 1580, target_protein: 96, target_carbs: 180, target_fat: 53 })
    expect(finished.profile).toMatchObject({ goal: 'maintain', pace: 0 })
    // The default protein comes back from the estimate and is kept with the answers
    expect(finished.profile.protein_per_kg).toBe(1.6)
  })

  it('says what a pace costs a day before the plan is worked out', async () => {
    const wizard = await mountSuspended(GoalWizard, { props: { initial: { ...BODY, goal: 'lose', pace: 0.5 } } })

    await button(wizard, 'Continue').trigger('click')
    await button(wizard, 'Continue').trigger('click')

    expect(wizard.text()).toContain('−550 kcal a day')
    expect(wizard.text()).not.toContain('A kilo a week is a lot')

    await button(wizard, '1 kg').trigger('click')

    expect(wizard.text()).toContain('A kilo a week is a lot')
  })

  it('keeps a pace the new direction offers when the goal changes', async () => {
    const asked = estimates()
    const wizard = await mountSuspended(GoalWizard, { props: { initial: { ...BODY, goal: 'lose', pace: 1 } } })
    await button(wizard, 'Continue').trigger('click')
    await button(wizard, 'Continue').trigger('click')

    // Gaining tops out at half a kilo a week
    await button(wizard, 'Gain weight').trigger('click')
    await button(wizard, 'Continue').trigger('click')

    await vi.waitFor(() => expect(asked[0]).toMatchObject({ goal: 'gain', pace: 0.5 }))
  })

  it('says when the goal was raised to a safe minimum', async () => {
    estimates({ ...ESTIMATE, kcal: 1200, floored: true })
    const wizard = await mountSuspended(GoalWizard, { props: { initial: { ...BODY, goal: 'lose', pace: 1 } } })

    await toThePlan(wizard)

    await vi.waitFor(() => expect(wizard.text()).toContain('Raised to a safe minimum'))
  })

  it('shows why the plan could not be worked out and will not save without one', async () => {
    estimates({ status: 422, detail: 'Nutrijurnal\'s targets are for people aged 13 and over' })
    const wizard = await mountSuspended(GoalWizard, { props: { initial: { ...BODY } } })

    await toThePlan(wizard)

    await vi.waitFor(() => expect(wizard.text()).toContain('targets are for people aged 13 and over'))
    expect(button(wizard, 'Save my targets').attributes('disabled')).toBeDefined()
    expect(wizard.emitted('finish')).toBeUndefined()
  })
})
