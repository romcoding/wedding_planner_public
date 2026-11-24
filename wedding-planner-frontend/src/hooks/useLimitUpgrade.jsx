import { useState, useCallback } from 'react'
import UpgradeModal from '../components/UpgradeModal'
import { usePlan } from './usePlan'
import { getApiCode, getApiData } from '../lib/api'

/**
 * Shows the existing UpgradeModal when the server answers 403 `limit_reached`.
 *
 *   const { handleLimitError, limitModal } = useLimitUpgrade()
 *   onError: (err) => { if (handleLimitError(err)) return; ... }
 *   ...render {limitModal}
 */
export function limitReason(data) {
  const n = data?.limit
  if (data?.feature === 'guests') {
    // Guests are counted by invitation (household), not by people.
    return `Your free plan includes up to ${n} guest entries. Each entry is one household or invitation, however many people it covers.`
  }
  if (data?.feature === 'tasks') return `Your free plan includes up to ${n} tasks.`
  return 'You have reached the limit of your current plan.'
}

export function useLimitUpgrade() {
  const [reason, setReason] = useState(null)
  const { plan } = usePlan()

  const handleLimitError = useCallback((err) => {
    if (getApiCode(err) !== 'limit_reached') return false
    setReason(limitReason(getApiData(err)))
    return true
  }, [])

  const limitModal = (
    <UpgradeModal isOpen={reason !== null} onClose={() => setReason(null)} reason={reason || ''} currentPlan={plan} />
  )
  return { handleLimitError, limitModal }
}
