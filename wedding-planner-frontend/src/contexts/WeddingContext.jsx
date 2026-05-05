import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const WeddingContext = createContext(null)

/**
 * WeddingContext — stores the active Wedding tenant object and exposes it globally.
 *
 * - Fetches /api/weddings/current on mount (if user is authenticated).
 * - Provides createWedding(), refreshWedding(), updateWedding().
 * - Exposes planMeets(minPlan) helper for gating UI.
 */
export function WeddingProvider({ children }) {
  const [wedding, setWedding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const PLAN_ORDER = { free: 0, starter: 1, premium: 2 }

  const fetchWedding = useCallback(async () => {
    const token = sessionStorage.getItem('access_token')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const res = await api.get('/weddings/current')
      setWedding(res.data)
      setError(null)
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.needs_onboarding) {
        setWedding(null)
        setError('needs_onboarding')
      } else if (err.response?.status !== 401) {
        setError(err.response?.data?.error || 'Failed to load wedding')
      } else {
        setWedding(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWedding()
  }, [fetchWedding])

  const createWedding = async (payload) => {
    try {
      const res = await api.post('/weddings/create', payload)
      setWedding(res.data.wedding)
      setError(null)
      return { success: true, wedding: res.data.wedding }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to create wedding',
      }
    }
  }

  const updateWedding = async (payload) => {
    try {
      const res = await api.put('/weddings/current', payload)
      setWedding(res.data)
      return { success: true, wedding: res.data }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to update wedding',
      }
    }
  }

  const refreshWedding = () => {
    setLoading(true)
    return fetchWedding()
  }

  /** Returns true if current wedding plan >= minPlan */
  const planMeets = (minPlan) => {
    if (!wedding) return false
    return (PLAN_ORDER[wedding.plan] ?? 0) >= (PLAN_ORDER[minPlan] ?? 0)
  }

  /** Return today's AI usage data */
  const getAiUsage = useCallback(async () => {
    try {
      const res = await api.get('/ai/usage')
      return res.data
    } catch {
      return null
    }
  }, [])

  return (
    <WeddingContext.Provider
      value={{
        wedding,
        loading,
        error,
        createWedding,
        updateWedding,
        refreshWedding,
        planMeets,
        getAiUsage,
        needsOnboarding: error === 'needs_onboarding',
      }}
    >
      {children}
    </WeddingContext.Provider>
  )
}

export function useWedding() {
  const ctx = useContext(WeddingContext)
  if (!ctx) throw new Error('useWedding must be used within WeddingProvider')
  return ctx
}

export default WeddingContext
