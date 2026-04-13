import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MapPin, Calendar, Sparkles, Check, ArrowRight, ArrowLeft, Zap, Crown } from 'lucide-react'
import { useWedding } from '../../contexts/WeddingContext'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Perfect for getting started',
    features: [
      'Up to 30 guests',
      'Up to 10 tasks',
      'Basic budget tracking',
      'Guest portal',
    ],
    limitations: ['No AI features', 'No custom slug'],
    icon: Heart,
    color: 'border-gray-200 bg-white',
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$9',
    period: '/mo',
    description: 'For most couples',
    features: [
      'Up to 150 guests',
      'Unlimited tasks',
      'Full budget tracking',
      'AI features (3/day)',
      'Custom URL slug',
      'Guest portal',
    ],
    icon: Zap,
    color: 'border-rose-400 bg-rose-50',
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$29',
    period: '/mo',
    description: 'For large or luxury weddings',
    features: [
      'Unlimited guests',
      'Unlimited tasks',
      'Full budget tracking',
      'Unlimited AI features',
      'Custom URL slug',
      'Guest portal + custom branding',
      'Priority support',
    ],
    icon: Crown,
    color: 'border-amber-400 bg-amber-50',
    highlight: false,
  },
]

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { createWedding } = useWedding()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    partner_one_name: '',
    partner_two_name: '',
    wedding_date: '',
    location: '',
    plan: 'free',
  })

  const updateForm = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  // ── Step validation ─────────────────────────────────────────────────────

  const step1Valid =
    form.partner_one_name.trim().length >= 2 &&
    form.partner_two_name.trim().length >= 2

  const step2Valid = !!form.plan

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleNext = () => {
    setError('')
    if (step === 1 && !step1Valid) {
      setError('Please enter both partner names.')
      return
    }
    setStep((s) => s + 1)
  }

  const handleBack = () => {
    setError('')
    setStep((s) => s - 1)
  }

  const handleLaunch = async () => {
    setSubmitting(true)
    setError('')

    const result = await createWedding({
      partner_one_name: form.partner_one_name.trim(),
      partner_two_name: form.partner_two_name.trim(),
      wedding_date: form.wedding_date || undefined,
      location: form.location.trim() || undefined,
    })

    if (!result.success) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    // If paid plan selected, redirect to billing checkout
    if (form.plan !== 'free') {
      navigate('/admin/billing?upgrade=' + form.plan)
    } else {
      navigate('/admin/wedding')
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  const selectedPlan = PLANS.find((p) => p.id === form.plan) || PLANS[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
            <span className="text-2xl font-bold text-gray-900">Wedding Planner</span>
          </div>
          <p className="text-gray-500 text-sm">Let's set up your wedding space</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step > s
                    ? 'bg-rose-500 text-white'
                    : step === s
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-12 transition-all ${
                    step > s ? 'bg-rose-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* ── Step 1: Couple Details ─────────────────────────────────── */}
          {step === 1 && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Tell us about your wedding</h2>
              <p className="text-gray-500 text-sm mb-6">We'll personalize your experience based on these details.</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Partner 1 Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah"
                      value={form.partner_one_name}
                      onChange={(e) => updateForm('partner_one_name', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Partner 2 Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John"
                      value={form.partner_two_name}
                      onChange={(e) => updateForm('partner_two_name', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Wedding Date
                  </label>
                  <input
                    type="date"
                    value={form.wedding_date}
                    onChange={(e) => updateForm('wedding_date', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tuscany, Italy"
                    value={form.location}
                    onChange={(e) => updateForm('location', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Choose Plan ────────────────────────────────────── */}
          {step === 2 && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose your plan</h2>
              <p className="text-gray-500 text-sm mb-6">You can change or upgrade at any time.</p>

              <div className="space-y-3">
                {PLANS.map((plan) => {
                  const Icon = plan.icon
                  const isSelected = form.plan === plan.id
                  return (
                    <button
                      key={plan.id}
                      onClick={() => updateForm('plan', plan.id)}
                      className={`w-full text-left border-2 rounded-xl p-4 transition-all ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isSelected ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{plan.name}</span>
                              {plan.highlight && (
                                <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">Popular</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{plan.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-gray-900">{plan.price}</span>
                          <span className="text-xs text-gray-500">{plan.period}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {plan.features.slice(0, 3).map((f) => (
                          <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{f}</span>
                        ))}
                        {plan.features.length > 3 && (
                          <span className="text-xs text-gray-400">+{plan.features.length - 3} more</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-7 h-7 text-rose-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Ready to launch!</h2>
                <p className="text-gray-500 text-sm">Here's a summary of your wedding space.</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Couple</span>
                  <span className="font-semibold text-gray-900">
                    {form.partner_one_name} & {form.partner_two_name}
                  </span>
                </div>
                {form.wedding_date && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Date</span>
                    <span className="font-medium text-gray-700">
                      {new Date(form.wedding_date).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {form.location && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Location</span>
                    <span className="font-medium text-gray-700">{form.location}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {selectedPlan.name} — {selectedPlan.price}{selectedPlan.period}
                  </span>
                </div>
              </div>

              {form.plan !== 'free' && (
                <p className="text-xs text-center text-gray-500 mb-4">
                  You'll be redirected to complete payment after launching your space.
                </p>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="px-8 pb-8 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {error && (
              <p className="text-sm text-red-500 flex-1 text-center px-4">{error}</p>
            )}

            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={step === 1 && !step1Valid}
                className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-200 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleLaunch}
                disabled={submitting}
                className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
              >
                {submitting ? 'Launching…' : 'Launch my wedding space'}
                {!submitting && <Sparkles className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Skip */}
        {step < 3 && (
          <p className="text-center mt-4 text-xs text-gray-400">
            Already set up?{' '}
            <button
              onClick={() => navigate('/admin/wedding')}
              className="underline hover:text-gray-600"
            >
              Go to dashboard
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
