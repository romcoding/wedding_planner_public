import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import api from '../../lib/api'
import { Send, CheckCircle, AlertCircle } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../components/ui/Toast'

function generateIdempotencyKey() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export default function Contact() {
  const { t } = useLanguage()
  const toast = useToast()
  const [formData, setFormData] = useState({
    subject: '',
    body: '',
  })
  const [hp, setHp] = useState('') // honeypot
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const idempotencyKey = useMemo(() => generateIdempotencyKey(), [])

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

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl md:text-3xl font-semibold mb-6" style={{ color: 'var(--wp-primary)' }}>{t('contactTitle')}</h2>
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
    </div>
  )
}
