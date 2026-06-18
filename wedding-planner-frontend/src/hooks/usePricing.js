import { useEffect, useState } from 'react'
import api from '../lib/api'
import { PRICING, DEFAULT_CURRENCY, getPricing, formatPrice } from '../config/pricing'

// Module-level cache so /api/geo is called once per session, not per component.
let cachedCurrency = null

/**
 * usePricing — resolves the visitor's presentment currency once via /api/geo
 * and exposes the matching PRICING entry. Falls back to CHF on any failure or
 * an unmapped currency, so the UI always has real, complete price ids.
 *
 * Returns:
 *   - currency   ('CHF' | 'EUR' | 'USD')
 *   - pricing    (the PRICING[currency] entry — amounts + symbol + price ids)
 *   - format(amount)  → e.g. "CHF 9" / "€9"
 */
export function usePricing() {
  const [currency, setCurrency] = useState(cachedCurrency || DEFAULT_CURRENCY)

  useEffect(() => {
    if (cachedCurrency) {
      setCurrency(cachedCurrency)
      return
    }
    let active = true
    api
      .get('/geo')
      .then((res) => {
        const cur = res.data?.currency
        const next = PRICING[cur] ? cur : DEFAULT_CURRENCY
        cachedCurrency = next
        if (active) setCurrency(next)
      })
      .catch(() => {
        if (active) setCurrency(DEFAULT_CURRENCY)
      })
    return () => {
      active = false
    }
  }, [])

  return {
    currency,
    pricing: getPricing(currency),
    format: (amount) => formatPrice(currency, amount),
  }
}

export default usePricing
