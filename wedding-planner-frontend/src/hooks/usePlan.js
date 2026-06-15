import { useEffect, useState } from 'react'
import { useWedding } from '../contexts/WeddingContext'
import api from '../lib/api'

const PREMIUM_PLANS = new Set(['premium', 'starter'])

/**
 * usePlan — single source of truth for "what plan is this wedding on?"
 *
 * Reads the plan from the existing WeddingContext (already loaded at admin
 * mount time), and quietly refreshes from the authoritative /billing/status
 * endpoint at most once per ~5 minutes. Designed to mirror the spec's
 * "useQuery with 5min stale time" semantics without pulling in React Query.
 *
 * Returns:
 *   - plan         ('free' | 'starter' | 'premium' | …)
 *   - isPremium    (boolean — true for starter/premium/lifetime)
 *   - isFree       (boolean)
 *   - limits       (object — from /billing/status)
 *   - expiresAt    (string | null — for lifetime plans)
 *   - refresh()    (async — force-refresh from the API)
 */
const STALE_MS = 5 * 60 * 1000
let cache = { at: 0, data: null }

export function usePlan() {
  const { wedding } = useWedding()
  const [status, setStatus] = useState(cache.data)

  const refresh = async () => {
    try {
      const res = await api.get('/billing/status')
      cache = { at: Date.now(), data: res.data }
      setStatus(res.data)
      return res.data
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!wedding) return
    if (cache.data && Date.now() - cache.at < STALE_MS) {
      setStatus(cache.data)
      return
    }
    refresh()
    // Intentionally keyed on wedding id only — refresh() reads the latest wedding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wedding?.id])

  const plan = status?.plan || wedding?.plan || 'free'
  return {
    plan,
    isPremium: PREMIUM_PLANS.has(plan),
    isFree: plan === 'free',
    limits: status?.limits || {},
    expiresAt: status?.plan_expires_at || null,
    refresh,
  }
}

export default usePlan
