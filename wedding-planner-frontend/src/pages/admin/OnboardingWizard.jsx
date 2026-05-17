import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Heart,
  Sparkles,
  Calendar,
  MapPin,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Crown,
} from 'lucide-react'
import { useWedding } from '../../contexts/WeddingContext'
import api from '../../lib/api'

const PALETTE = {
  bg: '#FAFAF8',
  fg: '#1A1A1A',
  primary: '#C4956A',
  secondary: '#2D4A3E',
  soft: '#F5EFE8',
}

const TOTAL_STEPS = 4
const MAX_GUESTS = 5
const ONBOARDING_FLAG = 'onboarding_completed'

const emptyGuest = () => ({ first_name: '', last_name: '', email: '', dietary_restrictions: '' })

function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8" aria-hidden="true">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const s = i + 1
        const done = step > s
        const active = step === s
        return (
          <div
            key={s}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: active ? 28 : 14,
              background: done ? PALETTE.secondary : active ? PALETTE.primary : '#E8E0D2',
            }}
          />
        )
      })}
    </div>
  )
}

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { wedding, createWedding, updateWedding, refreshWedding } = useWedding()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const initialNames = (() => {
    if (!wedding) return { partner_one_name: '', partner_two_name: '' }
    return {
      partner_one_name: wedding.partner_one_name || '',
      partner_two_name: wedding.partner_two_name || '',
    }
  })()

  const [details, setDetails] = useState({
    ...initialNames,
    couple_names: '',
    wedding_date: wedding?.wedding_date?.slice(0, 10) || '',
    venue_name: wedding?.location || '',
  })

  const [guests, setGuests] = useState([emptyGuest()])
  const [guestsAdded, setGuestsAdded] = useState(0)
  const [guestsSkipped, setGuestsSkipped] = useState(false)

  // Hydrate the couple_names field if the wedding already has partner names.
  useEffect(() => {
    if (!wedding) return
    const joined = [wedding.partner_one_name, wedding.partner_two_name].filter(Boolean).join(' & ')
    setDetails((d) => ({
      ...d,
      couple_names: d.couple_names || joined,
      wedding_date: d.wedding_date || wedding.wedding_date?.slice(0, 10) || '',
      venue_name: d.venue_name || wedding.location || '',
    }))
  }, [wedding])

  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  const goBack = () => setStep((s) => Math.max(1, s - 1))

  const updateDetail = (key, value) => setDetails((d) => ({ ...d, [key]: value }))

  const setGuestField = (idx, key, value) => {
    setGuests((rows) => rows.map((row, i) => (i === idx ? { ...row, [key]: value } : row)))
  }
  const addGuestRow = () => {
    if (guests.length >= MAX_GUESTS) return
    setGuests((rows) => [...rows, emptyGuest()])
  }
  const removeGuestRow = (idx) => {
    setGuests((rows) => rows.length === 1 ? [emptyGuest()] : rows.filter((_, i) => i !== idx))
  }

  /** Parse "Anna & Thomas" / "Anna and Thomas" into two partner names. */
  const splitCoupleNames = (raw) => {
    const text = (raw || '').trim()
    if (!text) return ['', '']
    const sep = text.includes(' & ') ? ' & ' : text.toLowerCase().includes(' and ') ? ' and ' : null
    if (!sep) return [text, '']
    const idx = text.toLowerCase().indexOf(sep)
    return [text.slice(0, idx).trim(), text.slice(idx + sep.length).trim()]
  }

  const handleSaveDetails = async () => {
    setSubmitting(true)
    setError('')
    const [p1, p2] = splitCoupleNames(details.couple_names)
    const payload = {
      partner_one_name: p1 || undefined,
      partner_two_name: p2 || undefined,
      wedding_date: details.wedding_date || undefined,
      location: details.venue_name?.trim() || undefined,
    }
    try {
      let res
      if (wedding) {
        res = await updateWedding(payload)
      } else {
        // Edge case — registration creates the wedding, but if it somehow doesn't
        // exist yet, create it now so step 3 can attach guests.
        res = await createWedding({
          partner_one_name: payload.partner_one_name || 'Partner 1',
          partner_two_name: payload.partner_two_name || 'Partner 2',
          wedding_date: payload.wedding_date,
          location: payload.location,
        })
      }
      if (!res?.success) {
        setError(res?.error || 'Could not save your details.')
        return
      }
      goNext()
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddGuests = async () => {
    setSubmitting(true)
    setError('')
    let created = 0
    try {
      for (const g of guests) {
        if (!g.first_name?.trim() || !g.email?.trim()) continue
        try {
          await api.post('/guests', {
            first_name: g.first_name.trim(),
            last_name: (g.last_name || '').trim(),
            email: g.email.trim(),
            dietary_restrictions: g.dietary_restrictions?.trim() || undefined,
            rsvp_status: 'pending',
          })
          created += 1
        } catch (e) {
          // Skip individual failures but keep the loop going.
          // eslint-disable-next-line no-console
          console.warn('Onboarding: failed to add guest', g.email, e?.response?.data || e)
        }
      }
      setGuestsAdded(created)
      goNext()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkipGuests = () => {
    setGuestsSkipped(true)
    setGuestsAdded(0)
    goNext()
  }

  const handleFinish = () => {
    try {
      localStorage.setItem(ONBOARDING_FLAG, 'true')
    } catch {
      // Private-mode browsers; ignore.
    }
    refreshWedding?.()
    navigate('/admin/wedding', { replace: true })
  }

  const detailsValid = (details.couple_names || '').trim().length >= 2

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: PALETTE.bg,
        color: PALETTE.fg,
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
      />

      <div className="w-full max-w-2xl">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Heart className="w-5 h-5" style={{ color: PALETTE.primary, fill: PALETTE.primary }} />
          <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 20, color: PALETTE.secondary }}>
            AI Wedding OS
          </span>
        </div>

        <StepDots step={step} />

        <div
          className="rounded-3xl shadow-xl overflow-hidden"
          style={{ background: '#fff', border: `1px solid ${PALETTE.soft}` }}
        >
          {/* ───────── Step 1: Welcome ───────── */}
          {step === 1 && (
            <div className="p-10 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h1
                className="text-3xl sm:text-4xl"
                style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg, lineHeight: 1.1 }}
              >
                Welcome to your wedding workspace!
              </h1>
              <p className="mt-4 text-[16px] leading-relaxed" style={{ color: '#4a4a4a' }}>
                Let&apos;s set up your planning hub in 2 minutes. We&apos;ll cover the basics — your story,
                your day, and your first guests — and then you&apos;re off.
              </p>
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
                  style={{ background: PALETTE.primary, boxShadow: '0 14px 40px -16px rgba(196,149,106,0.65)' }}
                >
                  Let&apos;s go
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ───────── Step 2: Your Details ───────── */}
          {step === 2 && (
            <div className="p-10">
              <h2
                className="text-2xl sm:text-3xl mb-1"
                style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg }}
              >
                Your details
              </h2>
              <p className="text-sm mb-6" style={{ color: '#6a6a6a' }}>
                We&apos;ll use these across your dashboard and your guest portal.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: PALETTE.secondary }}>
                    Your names
                  </label>
                  <input
                    type="text"
                    placeholder="Anna & Thomas"
                    value={details.couple_names}
                    onChange={(e) => updateDetail('couple_names', e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none focus:ring-2"
                    style={{
                      background: '#fff',
                      border: '1px solid #E8E0D2',
                      // @ts-ignore — CSS var fine in JSX
                      ['--tw-ring-color']: PALETTE.primary,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: PALETTE.secondary }}>
                    <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                    Wedding date
                  </label>
                  <input
                    type="date"
                    value={details.wedding_date}
                    onChange={(e) => updateDetail('wedding_date', e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none focus:ring-2"
                    style={{ background: '#fff', border: '1px solid #E8E0D2' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: PALETTE.secondary }}>
                    <MapPin className="w-3.5 h-3.5 inline mr-1.5" />
                    Venue name <span className="text-xs font-normal" style={{ color: '#8a8a8a' }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Lakeside Estate, Como"
                    value={details.venue_name}
                    onChange={(e) => updateDetail('venue_name', e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none focus:ring-2"
                    style={{ background: '#fff', border: '1px solid #E8E0D2' }}
                  />
                </div>
              </div>

              {error && <p className="mt-4 text-sm" style={{ color: '#9B2C2C' }}>{error}</p>}

              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: PALETTE.secondary }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  disabled={!detailsValid || submitting}
                  onClick={handleSaveDetails}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium text-white transition-colors disabled:opacity-50"
                  style={{ background: PALETTE.primary }}
                >
                  {submitting ? 'Saving…' : 'Next'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ───────── Step 3: Your first guests ───────── */}
          {step === 3 && (
            <div className="p-10">
              <h2
                className="text-2xl sm:text-3xl mb-1"
                style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg }}
              >
                Your first guests
              </h2>
              <p className="text-sm mb-6" style={{ color: '#6a6a6a' }}>
                Add a few guests to get started — you can always add more later.
              </p>

              <div className="space-y-3">
                {guests.map((g, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center rounded-xl p-3"
                    style={{ background: PALETTE.soft }}
                  >
                    <input
                      type="text"
                      placeholder="First name"
                      value={g.first_name}
                      onChange={(e) => setGuestField(i, 'first_name', e.target.value)}
                      className="col-span-3 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ background: '#fff', border: '1px solid #E8E0D2' }}
                    />
                    <input
                      type="text"
                      placeholder="Last"
                      value={g.last_name}
                      onChange={(e) => setGuestField(i, 'last_name', e.target.value)}
                      className="col-span-2 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ background: '#fff', border: '1px solid #E8E0D2' }}
                    />
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={g.email}
                      onChange={(e) => setGuestField(i, 'email', e.target.value)}
                      className="col-span-4 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ background: '#fff', border: '1px solid #E8E0D2' }}
                    />
                    <input
                      type="text"
                      placeholder="Dietary"
                      value={g.dietary_restrictions}
                      onChange={(e) => setGuestField(i, 'dietary_restrictions', e.target.value)}
                      className="col-span-2 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ background: '#fff', border: '1px solid #E8E0D2' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeGuestRow(i)}
                      className="col-span-1 inline-flex items-center justify-center rounded-lg h-9 text-xs hover:bg-white transition-colors"
                      style={{ color: '#9B2C2C' }}
                      aria-label="Remove guest"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {guests.length < MAX_GUESTS && (
                <button
                  type="button"
                  onClick={addGuestRow}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: PALETTE.secondary }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add another
                </button>
              )}

              {error && <p className="mt-4 text-sm" style={{ color: '#9B2C2C' }}>{error}</p>}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: PALETTE.secondary }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSkipGuests}
                    disabled={submitting}
                    className="text-sm underline disabled:opacity-50"
                    style={{ color: '#7a7264' }}
                  >
                    I&apos;ll add guests later
                  </button>
                  <button
                    type="button"
                    onClick={handleAddGuests}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: PALETTE.primary }}
                  >
                    {submitting ? 'Adding…' : 'Save & continue'}
                    {!submitting && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ───────── Step 4: Done ───────── */}
          {step === 4 && (
            <div className="p-10 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2
                className="text-3xl sm:text-4xl"
                style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg, lineHeight: 1.1 }}
              >
                Your workspace is ready!
              </h2>
              <p className="mt-3 text-[15px]" style={{ color: '#4a4a4a' }}>
                Here&apos;s what we just set up for you:
              </p>

              <ul className="mt-6 space-y-2 text-left max-w-md mx-auto">
                <li className="flex items-start gap-2 text-[15px]">
                  <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: PALETTE.primary }} />
                  <span>Couple — <strong>{details.couple_names || 'You & your partner'}</strong></span>
                </li>
                {details.wedding_date && (
                  <li className="flex items-start gap-2 text-[15px]">
                    <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: PALETTE.primary }} />
                    <span>Date — <strong>{details.wedding_date}</strong></span>
                  </li>
                )}
                {details.venue_name && (
                  <li className="flex items-start gap-2 text-[15px]">
                    <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: PALETTE.primary }} />
                    <span>Venue — <strong>{details.venue_name}</strong></span>
                  </li>
                )}
                <li className="flex items-start gap-2 text-[15px]">
                  <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: PALETTE.primary }} />
                  <span>
                    Guests — {guestsSkipped
                      ? <em style={{ color: '#7a7264' }}>none yet (you can add them anytime)</em>
                      : <strong>{guestsAdded} added</strong>}
                  </span>
                </li>
              </ul>

              <button
                type="button"
                onClick={handleFinish}
                className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
                style={{ background: PALETTE.secondary, boxShadow: '0 14px 40px -16px rgba(45,74,62,0.45)' }}
              >
                Go to my dashboard
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Subtle upsell */}
              <div
                className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                style={{ background: PALETTE.soft, color: PALETTE.secondary }}
              >
                <Crown className="w-3.5 h-3.5" style={{ color: PALETTE.primary }} />
                <span>
                  Need more than 30 guests?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem(ONBOARDING_FLAG, 'true')
                      } catch {
                        // ignore — private-mode browser
                      }
                      refreshWedding?.()
                      navigate('/admin/billing', { replace: true })
                    }}
                    className="underline font-medium"
                  >
                    Upgrade to Premium →
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {step < TOTAL_STEPS && (
          <p className="text-center mt-4 text-xs" style={{ color: '#9a9182' }}>
            <Sparkles className="w-3 h-3 inline mr-1" style={{ color: PALETTE.primary }} />
            You can always change these later in your dashboard.
          </p>
        )}
      </div>
    </main>
  )
}
