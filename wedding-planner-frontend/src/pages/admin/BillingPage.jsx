import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, Check, Zap, Crown, Heart, ExternalLink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useWedding } from '../../contexts/WeddingContext'
import api from '../../lib/api'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    icon: Heart,
    color: 'text-gray-600',
    bg: 'bg-gray-50 border-gray-200',
    features: [
      'Up to 30 guests',
      'Up to 10 tasks',
      'Basic budget tracking',
      'Guest portal',
      'RSVP management',
    ],
    missing: ['AI features', 'Custom URL slug', 'Unlimited guests'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    period: 'month',
    icon: Zap,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-300',
    highlight: true,
    features: [
      'Up to 150 guests',
      'Unlimited tasks',
      'Full budget tracking',
      'AI Timeline Builder',
      'AI Vendor Suggestions',
      'AI Website Copy',
      'AI Seating (3 uses/day)',
      'Custom URL slug',
      'Guest portal',
    ],
    missing: ['Unlimited AI uses', 'Custom branding'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 29,
    period: 'month',
    icon: Crown,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-300',
    features: [
      'Unlimited guests',
      'Unlimited tasks',
      'Full budget tracking',
      'Unlimited AI features',
      'Custom URL slug',
      'Guest portal + custom branding',
      'Priority support',
    ],
    missing: [],
  },
]

export default function BillingPage() {
  const { wedding, refreshWedding } = useWedding()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Handle redirect back from Stripe
  useEffect(() => {
    const status = searchParams.get('status')
    const upgrade = searchParams.get('upgrade')
    if (status === 'success') {
      setSuccessMessage('Payment successful! Your plan has been upgraded.')
      refreshWedding()
    }
    if (upgrade && wedding && wedding.plan === 'free') {
      handleUpgrade(upgrade)
    }
  }, []) // eslint-disable-line

  const handleUpgrade = async (planId) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/billing/create-checkout-session', { plan: planId })
      window.location.href = res.data.checkout_url
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to start checkout. Please try again.')
      setLoading(false)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    setError('')
    try {
      const res = await api.get('/billing/portal')
      window.open(res.data.portal_url, '_blank')
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to open billing portal.')
    } finally {
      setPortalLoading(false)
    }
  }

  const currentPlan = PLANS.find((p) => p.id === (wedding?.plan || 'free'))

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your subscription and upgrade your wedding space.</p>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Current plan */}
      {wedding && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentPlan && (
                <div className={`w-10 h-10 rounded-xl ${currentPlan.bg} flex items-center justify-center border`}>
                  <currentPlan.icon className={`w-5 h-5 ${currentPlan.color}`} />
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Current plan</p>
                <p className="font-semibold text-gray-900 text-lg capitalize">{wedding.plan}</p>
              </div>
            </div>
            {wedding.stripe_customer_id && (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage billing
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const Icon = plan.icon
          const isCurrent = wedding?.plan === plan.id
          const isDowngrade = PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === (wedding?.plan || 'free'))

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border-2 p-5 flex flex-col ${
                plan.highlight
                  ? 'border-blue-400 shadow-lg shadow-blue-100'
                  : isCurrent
                  ? 'border-green-400'
                  : 'border-gray-200'
              }`}
            >
              {plan.highlight && (
                <div className="text-center -mt-8 mb-2">
                  <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}
              {isCurrent && !plan.highlight && (
                <div className="text-center -mt-8 mb-2">
                  <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">Current Plan</span>
                </div>
              )}

              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-9 h-9 rounded-lg ${plan.bg} border flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${plan.color}`} />
                </div>
                <span className="font-semibold text-gray-900">{plan.name}</span>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-sm text-gray-500">/{plan.period}</span>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="flex items-center justify-center gap-2 border border-green-200 text-green-700 text-sm font-medium py-2.5 rounded-lg bg-green-50">
                  <Check className="w-4 h-4" />
                  Current Plan
                </div>
              ) : isDowngrade ? (
                <button
                  onClick={handlePortal}
                  disabled={!wedding?.stripe_customer_id}
                  className="w-full border border-gray-200 text-gray-500 text-sm py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Manage in Portal
                </button>
              ) : plan.id !== 'free' ? (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading}
                  className={`w-full text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    plan.highlight
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-gray-900 hover:bg-gray-800'
                  } disabled:opacity-60`}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Upgrade to {plan.name}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        All plans include SSL security. Cancel anytime. Payments processed by Stripe.
      </p>
    </div>
  )
}
