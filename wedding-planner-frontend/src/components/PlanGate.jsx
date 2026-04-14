import { useNavigate } from 'react-router-dom'
import { Lock, Zap, Crown, ArrowRight } from 'lucide-react'
import { useWedding } from '../contexts/WeddingContext'

const PLAN_ICONS = {
  starter: Zap,
  premium: Crown,
}

const PLAN_LABELS = {
  starter: 'Starter',
  premium: 'Premium',
}

const PLAN_PRICES = {
  starter: '$9/mo',
  premium: '$29/mo',
}

/**
 * PlanGate — wraps content that requires a minimum plan.
 *
 * Usage:
 *   <PlanGate plan="starter">
 *     <MyPremiumFeature />
 *   </PlanGate>
 *
 * Props:
 *   plan         — 'starter' | 'premium' — minimum required plan
 *   children     — content to render when plan is sufficient
 *   fallback     — optional custom fallback element (instead of default upgrade prompt)
 *   inline       — if true, renders a compact inline badge instead of a full card
 */
export default function PlanGate({ plan, children, fallback, inline = false }) {
  const { planMeets, wedding } = useWedding()
  const navigate = useNavigate()

  // If no wedding context yet (loading), render nothing to avoid flicker
  if (!wedding) return null

  // Plan is sufficient — render children
  if (planMeets(plan)) return <>{children}</>

  // Custom fallback
  if (fallback) return <>{fallback}</>

  const Icon = PLAN_ICONS[plan] || Lock
  const label = PLAN_LABELS[plan] || plan
  const price = PLAN_PRICES[plan] || ''

  if (inline) {
    return (
      <button
        onClick={() => navigate('/admin/billing')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors"
      >
        <Lock className="w-3 h-3" />
        {label} feature
        <ArrowRight className="w-3 h-3" />
      </button>
    )
  }

  return (
    <div className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[180px]">
      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
        <Icon className="w-6 h-6 text-amber-600" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 text-base">
          {label} feature
        </h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          This feature is available on the <strong>{label}</strong> plan
          {price ? ` (${price})` : ''}. Upgrade to unlock it.
        </p>
      </div>
      <button
        onClick={() => navigate('/admin/billing')}
        className="mt-2 flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Upgrade to {label}
        <ArrowRight className="w-4 h-4" />
      </button>
      <p className="text-xs text-gray-400">Current plan: <span className="capitalize font-medium">{wedding?.plan}</span></p>
    </div>
  )
}
