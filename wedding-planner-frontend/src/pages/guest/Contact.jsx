import { useState, useMemo, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import api from '../../lib/api'
import { Send, CheckCircle, AlertCircle, Phone, User } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../components/ui/Toast'

function generateIdempotencyKey() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export default function Contact() {
  const { t } = useLanguage()
  const toast = useToast()
  const [contactMode, setContactMode] = useState('couple')
  const [formData, setFormData] = useState({
    subject: '',
    body: '',
  })
  const [hp, setHp] = useState('') // honeypot
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const idempotencyKey = useMemo(() => generateIdempotencyKey(), [])
  const formRef = useRef(null)

  // Parse witness data from content
  const witnessCards = useMemo(() => {
    try {
      const raw = t('guest_witnesses')
      if (!raw || raw === 'guest_witnesses') return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((w) => w.name || w.image) : []
    } catch {
      return []
    }
  }, [t])

  const sendMessage = useMutation({
    mutationFn: (data) => api.post('/messages', data),
    onSuccess: () => {
      setSubmitted(true)
      setFormData({ subject: '', body: '' })
      setError(null)
      toast.success(t('contactSentTitle'), 5000)
      setTimeout(() => setSubmitted(false), 5000)
    },
    onError: (err) => {
      const msg = err.response?.data?.error || t('contactSendFailed')
      setError(msg)
      toast.error(msg, 5000)
      // Focus the first field so the user sees the error
      setTimeout(() => {
        formRef.current?.querySelector('input, textarea')?.focus()
      }, 100)
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === '_hp') {
      setHp(value)
      return
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    const payload = {
      subject: formData.subject,
      body: formData.body,
      idempotency_key: idempotencyKey,
      _hp: hp,
    }
    sendMessage.mutate(payload)
  }

  const handleRetry = () => {
    setError(null)
    sendMessage.mutate({
      subject: formData.subject,
      body: formData.body,
      idempotency_key: idempotencyKey,
      _hp: hp,
    })
  }

  const hasWitnesses = witnessCards.length > 0

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl md:text-3xl font-semibold mb-2" style={{ color: 'var(--wp-primary)' }}>{t('contactTitle')}</h2>

      {/* Toggle buttons - only show if there are witness cards */}
      {hasWitnesses && (
        <div className="flex justify-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setContactMode('couple')}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all border"
            style={
              contactMode === 'couple'
                ? { backgroundColor: 'var(--wp-primary)', color: '#fff', borderColor: 'var(--wp-primary)' }
                : { backgroundColor: 'transparent', color: 'var(--wp-primary)', borderColor: 'var(--wp-primary)' }
            }
          >
            {t('contactBrideGroom')}
          </button>
          <button
            type="button"
            onClick={() => setContactMode('witnesses')}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all border"
            style={
              contactMode === 'witnesses'
                ? { backgroundColor: 'var(--wp-primary)', color: '#fff', borderColor: 'var(--wp-primary)' }
                : { backgroundColor: 'transparent', color: 'var(--wp-primary)', borderColor: 'var(--wp-primary)' }
            }
          >
            {t('contactWitnesses')}
          </button>
        </div>
      )}

      {/* Bride & Groom contact form */}
      {contactMode === 'couple' && (
        <>
          <p className="mb-8" style={{ color: 'var(--wp-primary)' }}>
            {t('contactIntro')}
          </p>

          <div className="bg-white/60 rounded-lg border border-black/5 p-8">
            {submitted && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{t('contactSentTitle')}</span>
              </div>
            )}

            {error && !submitted && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-medium text-sm whitespace-nowrap"
                >
                  {t('contactRetry')}
                </button>
              </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot - hidden from users, bots may fill it */}
              <div className="absolute -left-[9999px] top-0" aria-hidden="true">
                <label htmlFor="contact_hp">Leave blank</label>
                <input
                  type="text"
                  id="contact_hp"
                  name="_hp"
                  tabIndex={-1}
                  autoComplete="off"
                  value={hp}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-2" style={{ color: 'var(--wp-primary)' }}>
                  {t('contactSubjectLabel')}
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder={t('contactSubjectPlaceholder')}
                  className="w-full px-4 py-2 border border-black/10 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              <div>
                <label htmlFor="body" className="block text-sm font-medium mb-2" style={{ color: 'var(--wp-primary)' }}>
                  {t('contactMessageLabel')}
                </label>
                <textarea
                  id="body"
                  name="body"
                  required
                  rows={8}
                  value={formData.body}
                  onChange={handleChange}
                  placeholder={t('contactMessagePlaceholder')}
                  className="w-full px-4 py-2 border border-black/10 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              <button
                type="submit"
                disabled={sendMessage.isPending || submitted}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg disabled:opacity-50 font-medium transition-all"
                style={{ backgroundColor: 'var(--wp-primary)' }}
              >
                <Send className="w-5 h-5" />
                {sendMessage.isPending ? t('contactSending') : t('contactSendButton')}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Witnesses flip cards */}
      {contactMode === 'witnesses' && (
        <div>
          <p className="mb-6 text-sm" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>
            {t('witnessCardFlipHint')}
          </p>
          <div
            className="grid gap-6 justify-items-center"
            style={{
              justifyContent: 'center',
              gridTemplateColumns: witnessCards.length === 1
                ? '1fr'
                : witnessCards.length === 2
                  ? 'repeat(2, minmax(0, 280px))'
                  : 'repeat(auto-fit, minmax(220px, 280px))',
            }}
          >
            {witnessCards.map((w, idx) => (
              <FlipCard key={idx} witness={w} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Flip Card Component ── */
function FlipCard({ witness, t }) {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <div
      className="w-full cursor-pointer"
      style={{ perspective: '1000px', maxWidth: '280px' }}
      onClick={() => setIsFlipped((f) => !f)}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '133%', /* 3:4 aspect ratio */
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s ease',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front - Image */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: '1rem',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          }}
        >
          {witness.image ? (
            <img
              src={witness.image}
              alt={witness.name || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--wp-secondary, #7C3AED)',
              }}
            >
              <User style={{ width: '4rem', height: '4rem', color: '#fff', opacity: 0.6 }} />
            </div>
          )}
          {/* Name overlay at bottom of image */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '1.5rem 1rem 1rem',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{witness.name}</div>
          </div>
        </div>

        {/* Back - Contact info */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: '1rem',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: 'var(--wp-background, #F7F3EA)',
            border: '2px solid var(--wp-primary, #EC4899)',
          }}
        >
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              backgroundColor: 'var(--wp-primary, #EC4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <Phone style={{ width: '1.5rem', height: '1.5rem', color: '#fff' }} />
          </div>

          <div style={{ color: 'var(--wp-primary, #EC4899)', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {witness.name}
          </div>

          {witness.phone && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--wp-primary, #EC4899)', opacity: 0.6, marginBottom: '0.25rem' }}>
                {t('witnessPhoneLabel')}
              </div>
              <a
                href={`tel:${witness.phone.replace(/\s/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'var(--wp-primary, #EC4899)',
                  textDecoration: 'none',
                }}
              >
                {witness.phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
