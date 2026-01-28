import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import api from '../../lib/api'
import { Mail, Send, CheckCircle } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function Contact() {
  const { guest } = useGuestAuth()
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    subject: '',
    body: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const sendMessage = useMutation({
    mutationFn: (data) => api.post('/messages', data),
    onSuccess: () => {
      setSubmitted(true)
      setFormData({ subject: '', body: '' })
      setTimeout(() => setSubmitted(false), 5000)
    },
    onError: (error) => {
      alert(error.response?.data?.error || t('contactSendFailed'))
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage.mutate(formData)
  }

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--wp-primary)' }}>{t('contactTitle')}</h2>
      <p className="mb-8" style={{ color: 'var(--wp-primary)' }}>
        {t('contactIntro')}
      </p>

      <div className="bg-white/60 rounded-lg border border-black/5 p-8">
        {submitted && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>{t('contactSentTitle')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
            disabled={sendMessage.isPending}
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

