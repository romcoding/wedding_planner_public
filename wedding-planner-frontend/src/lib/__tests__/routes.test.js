import { describe, it, expect } from 'vitest'
import { ROUTES } from '../routes'

describe('ROUTES', () => {
  it('keeps guest paths in sync with the router', () => {
    expect(ROUTES.GUEST_LOGIN).toBe('/guest/login')
    expect(ROUTES.GUEST_INFO).toBe('/guest/info')
    expect(ROUTES.GUEST_RSVP('abc123')).toBe('/guest/rsvp/abc123')
  })
})
