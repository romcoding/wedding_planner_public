import { describe, it, expect } from 'vitest'
import { limitReason } from '../useLimitUpgrade'

describe('limitReason', () => {
  it('explains that guests are counted as households', () => {
    const r = limitReason({ feature: 'guests', limit: 30 })
    expect(r).toMatch(/30 guest entries/)
    expect(r).toMatch(/household/)
  })
  it('handles tasks and unknown features', () => {
    expect(limitReason({ feature: 'tasks', limit: 10 })).toMatch(/10 tasks/)
    expect(limitReason({})).toMatch(/limit/)
  })
})
