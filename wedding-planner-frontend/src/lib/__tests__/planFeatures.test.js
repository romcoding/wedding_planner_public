import { describe, it, expect } from 'vitest'
import { FEATURE_MIN_PLAN, PLAN_ORDER, PLAN_NAMES, hasFeature } from '../planFeatures'

// UX gate map mirrors backend entitlements.PLANS: free = the basics; premium &
// lifetime = everything (lifetime has the same feature set as premium server-side).
const FREE_FEATURES = ['dashboard', 'guests', 'tasks', 'budget_basic', 'content_basic', 'analytics_basic']
const PAID_FEATURES = [
  'budget_full', 'custom_slug', 'wedi', 'invitations', 'events', 'moodboard',
  'guest_photos', 'agenda', 'seating', 'messages', 'gift_registry', 'venue',
  'rsvp_reminders', 'website',
]

describe('planFeatures (Bug 3 — "starter" consolidated into "premium")', () => {
  it('has no "starter" anywhere', () => {
    expect(PLAN_ORDER.starter).toBeUndefined()
    expect(PLAN_NAMES.starter).toBeUndefined()
    expect(Object.values(FEATURE_MIN_PLAN)).not.toContain('starter')
    expect(PLAN_ORDER).toEqual({ free: 0, premium: 1, lifetime: 2 })
    expect(Object.keys(PLAN_NAMES).sort()).toEqual(['free', 'lifetime', 'premium'])
  })

  it('every paid feature requires exactly "premium"', () => {
    for (const f of PAID_FEATURES) expect(FEATURE_MIN_PLAN[f]).toBe('premium')
  })

  it('free features are free; the free plan is gated out of paid features', () => {
    for (const f of FREE_FEATURES) {
      expect(FEATURE_MIN_PLAN[f]).toBe('free')
      expect(hasFeature('free', f)).toBe(true)
    }
    for (const f of PAID_FEATURES) expect(hasFeature('free', f)).toBe(false)
  })

  it('premium and lifetime clear every gate (mirror backend full entitlements)', () => {
    for (const f of [...FREE_FEATURES, ...PAID_FEATURES]) {
      expect(hasFeature('premium', f)).toBe(true)
      expect(hasFeature('lifetime', f)).toBe(true)
    }
  })
})
