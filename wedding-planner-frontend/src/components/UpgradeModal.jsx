import { X, Zap, Crown, Check, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * UpgradeModal — shown when a user hits a plan limit.
 *
 * Props:
 *   isOpen       — boolean
 *   onClose      — function
 *   reason       — string description of what was blocked
 *   currentPlan  — 'free' | 'starter' | 'premium'
 *   suggestPlan  — 'starter' | 'premium' (which plan to suggest)
 */
export default function UpgradeModal({ isOpen, onClose, reason, currentPlan = 'free', suggestPlan = 'starter' }) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$9/mo',
      icon: Zap,
      color: 'text-blue-600 bg-blue-50',
      features: ['Up to 150 guests', '3 AI uses/day', 'Custom URL slug', 'Full budget tracking'],
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '$29/mo',
      icon: Crown,
      color: 'text-amber-600 bg-amber-50',
      features: ['Unlimited guests', 'Unlimited AI', 'Custom branding', 'Priority support'],
    },
  ]

  const suggested = plans.find((p) => p.id === suggestPlan) || plans[0]
  const SuggestedIcon = suggested.icon

  const handleUpgrade = () => {
    onClose()
    navigate(`/admin/billing?upgrade=${suggestPlan}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-rose-500 to-amber-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className={`w-11 h-11 rounded-xl ${suggested.color} flex items-center justify-center mb-3`}>
            <SuggestedIcon className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold">Upgrade to {suggested.name}</h2>
          {reason && <p className="text-white/80 text-sm mt-1">{reason}</p>}
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-3xl font-bold text-gray-900">{suggested.price.split('/')[0]}</span>
            <span className="text-gray-500 text-sm">/month</span>
          </div>

          <ul className="space-y-2.5 mb-6">
            {suggested.features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleUpgrade}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            Upgrade now
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            Current plan: <span className="font-medium capitalize">{currentPlan}</span>
            {' · '}Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}
