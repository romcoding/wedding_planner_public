import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/api', () => ({ default: { post: vi.fn(() => Promise.resolve({})) } }))
import api from '../../lib/api'

let mod
beforeEach(async () => {
  vi.resetModules()
  api.post.mockClear()
  mod = await import('../analytics')
})

describe('analytics tracking', () => {
  it('posts to /analytics/track only', () => {
    mod.trackRouteChange('/guest/rsvp/abc')
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post.mock.calls[0][0]).toBe('/analytics/track')
    expect(api.post.mock.calls[0][1].path).toBe('/guest/rsvp/abc')
  })
  it('skips app screens and consecutive duplicates', () => {
    mod.trackRouteChange('/admin/guests')
    mod.trackRouteChange('/auth')
    mod.trackRouteChange('/onboarding/x')
    expect(api.post).not.toHaveBeenCalled()
    mod.trackRouteChange('/a')
    mod.trackRouteChange('/a')
    mod.trackRouteChange('/b')
    expect(api.post).toHaveBeenCalledTimes(2)
  })
  it('swallows tracking failures', async () => {
    api.post.mockReturnValueOnce(Promise.reject(new Error('429')))
    expect(() => mod.trackRouteChange('/x')).not.toThrow()
    await Promise.resolve()
  })
})
