import { describe, it, expect } from 'vitest'
import { getApiError, getApiCode, getApiData } from '../api'

const err = (data, status = 400) => ({ response: { status, data } })

describe('getApiError', () => {
  it('reads detail first, then legacy error, then the fallback', () => {
    expect(getApiError(err({ code: 'x', detail: 'From detail', error: 'legacy' }), 'fb')).toBe('From detail')
    expect(getApiError(err({ error: 'legacy' }), 'fb')).toBe('legacy')
    expect(getApiError(err({ code: 'x' }), 'fb')).toBe('fb')
    expect(getApiError(new Error('network'), 'fb')).toBe('fb')
    expect(getApiError(undefined, 'fb')).toBe('fb')
  })
  it('never returns an object or HTML', () => {
    expect(getApiError(err({ detail: { nested: true } }), 'fb')).toBe('fb')
    expect(getApiError(err('<html>502</html>'), 'fb')).toBe('fb')
  })
  it('exposes code and the structured extras', () => {
    const e = err({ code: 'missing_fields', detail: 'd', missing_fields: ['a'] })
    expect(getApiCode(e)).toBe('missing_fields')
    expect(getApiData(e).missing_fields).toEqual(['a'])
    expect(getApiCode(err('text'))).toBeNull()
  })
})
