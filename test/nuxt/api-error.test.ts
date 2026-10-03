import { describe, expect, it } from 'vitest'

describe('what a failed request says to a person', () => {
  it('passes on the API’s own sentence', () => {
    const error = { data: { detail: 'Nothing to copy on that day' }, response: { status: 404 } }

    expect(apiErrorMessage(error)).toBe('Nothing to copy on that day')
  })

  it('names the field a validation error is about', () => {
    const error = {
      data: { detail: [{ loc: ['body', 'password'], msg: 'String should have at least 8 characters' }] },
      response: { status: 422 }
    }

    expect(apiErrorMessage(error)).toBe('password: String should have at least 8 characters')
  })

  it('names a nested field by its last part', () => {
    const error = { data: { detail: [{ loc: ['body', 'items', 0, 'quantity'], msg: 'Input should be greater than or equal to 0' }] } }

    expect(apiErrorMessage(error)).toBe('quantity: Input should be greater than or equal to 0')
  })

  it('says only the message when it is about the whole body', () => {
    const error = { data: { detail: [{ loc: ['body'], msg: 'Field required' }] } }

    expect(apiErrorMessage(error)).toBe('Field required')
  })

  it('says there is no connection when there was no answer at all — in words for the public', () => {
    expect(apiErrorMessage(new TypeError('fetch failed'))).toBe('No connection — check your internet and try again.')
    expect(apiErrorMessage({ response: { status: 0 } })).toBe(NO_CONNECTION)
    expect(NO_CONNECTION).not.toMatch(/API|backend|server/i)
  })

  it('falls back to the caller’s words for an answer with nothing to say', () => {
    expect(apiErrorMessage({ response: { status: 500 } })).toBe('Something went wrong.')
    expect(apiErrorMessage({ response: { status: 502 }, data: { detail: [] } }, 'Could not save the meal.')).toBe('Could not save the meal.')
  })
})
