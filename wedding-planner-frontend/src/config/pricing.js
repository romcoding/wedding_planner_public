// Single source of truth for plan pricing + the Stripe price ids per currency.
//
// All three currencies are live in Stripe at the same numeric amounts (9 / 149).
// The displayed currency is always the charged currency: checkout sends the
// price id from the SAME entry the UI rendered, so there is never a mismatch.
// (Sandbox ids; live-mode equivalents are swapped via env in the P5 runbook,
// the same pattern as the backend webhook price→plan map.)

export const PRICING = {
  CHF: {
    symbol: 'CHF',
    monthly: 9,
    lifetime: 149,
    monthlyPriceId: 'price_1TXkacDTUwCAfgW5yZgz8fwC',
    lifetimePriceId: 'price_1TXkahDTUwCAfgW5KURJ4UN4',
  },
  EUR: {
    symbol: '€',
    monthly: 9,
    lifetime: 149,
    monthlyPriceId: 'price_1Tjb2hDTUwCAfgW527cebZO5',
    lifetimePriceId: 'price_1Tjb2nDTUwCAfgW5DE1GIcuy',
  },
  USD: {
    symbol: '$',
    monthly: 9,
    lifetime: 149,
    monthlyPriceId: 'price_1Tjb2kDTUwCAfgW5ZhFN6saU',
    lifetimePriceId: 'price_1Tjb2qDTUwCAfgW5rwvV997E',
  },
}

// Home currency — the fallback whenever /api/geo fails or returns an unmapped
// currency.
export const DEFAULT_CURRENCY = 'CHF'

export function getPricing(currency) {
  return PRICING[currency] || PRICING[DEFAULT_CURRENCY]
}

// Format an amount with its currency symbol: "CHF 9" (alphabetic code → spaced),
// "€9" / "$9" (symbol → tight).
export function formatPrice(currency, amount) {
  const p = getPricing(currency)
  return /^[A-Za-z]/.test(p.symbol) ? `${p.symbol} ${amount}` : `${p.symbol}${amount}`
}
