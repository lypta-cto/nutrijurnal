import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import LoginPage from '~/pages/login.vue'
import RegisterPage from '~/pages/register.vue'

/** What each field tells the phone's keyboard and password manager */
async function hints(page: typeof LoginPage) {
  registerEndpoint('/api/v1/auth/providers', () => ({ google: false }))
  const form = await mountSuspended(page)
  const found = Object.fromEntries(form.findAll('input').map(input => [input.attributes('name'), input.attributes('autocomplete')]))
  form.unmount()
  return found
}

describe('the sign-in and sign-up forms', () => {
  it('let a password manager fill in an account it saved', async () => {
    expect(await hints(LoginPage)).toEqual({ email: 'email', password: 'current-password' })
  })

  it('let a password manager save the new account, and suggest a password', async () => {
    expect(await hints(RegisterPage)).toEqual({ full_name: 'name', email: 'email', password: 'new-password' })
  })
})
