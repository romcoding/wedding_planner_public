import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { PRICING, DEFAULT_CURRENCY, formatPrice, getPricing } from '../../config/pricing'

// Mock the shared axios instance so usePricing's /api/geo call is controllable.
const getMock = vi.fn()
vi.mock('../../lib/api', () => ({ default: { get: (...args) => getMock(...args) } }))

beforeEach(() => {
  vi.resetModules() // clear usePricing's module-level currency cache between tests
  getMock.mockReset()
})

describe('pricing config (single source of truth)', () => {
  it('formats CHF spaced and €/$ tight', () => {
    expect(formatPrice('CHF', 9)).toBe('CHF 9')
    expect(formatPrice('CHF', 149)).toBe('CHF 149')
    expect(formatPrice('EUR', 9)).toBe('€9')
    expect(formatPrice('USD', 149)).toBe('$149')
  })

  it('falls back to CHF for an unmapped currency', () => {
    expect(getPricing('GBP')).toBe(PRICING[DEFAULT_CURRENCY])
  })

  it('every currency has complete, real price ids at 9 / 149', () => {
    for (const cur of ['CHF', 'EUR', 'USD']) {
      expect(PRICING[cur].monthly).toBe(9)
      expect(PRICING[cur].lifetime).toBe(149)
      expect(PRICING[cur].monthlyPriceId).toMatch(/^price_/)
      expect(PRICING[cur].lifetimePriceId).toMatch(/^price_/)
    }
  })
})

describe('usePricing', () => {
  it('falls back to CHF when /api/geo fails', async () => {
    getMock.mockRejectedValueOnce(new Error('network down'))
    const { usePricing } = await import('../usePricing')
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/geo'))
    expect(result.current.currency).toBe('CHF')
    expect(result.current.pricing.monthlyPriceId).toBe(PRICING.CHF.monthlyPriceId)
  })

  it('uses the geo currency and its matching price ids (no mismatch)', async () => {
    getMock.mockResolvedValueOnce({ data: { country: 'DE', currency: 'EUR' } })
    const { usePricing } = await import('../usePricing')
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(result.current.currency).toBe('EUR'))
    // Checkout sends THIS currency's id → always matches what was displayed.
    expect(result.current.pricing.monthlyPriceId).toBe(PRICING.EUR.monthlyPriceId)
    expect(result.current.format(result.current.pricing.monthly)).toBe('€9')
  })

  it('falls back to CHF when /api/geo returns an unmapped currency', async () => {
    getMock.mockResolvedValueOnce({ data: { currency: 'GBP' } })
    const { usePricing } = await import('../usePricing')
    const { result } = renderHook(() => usePricing())
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(result.current.currency).toBe('CHF')
  })
})
