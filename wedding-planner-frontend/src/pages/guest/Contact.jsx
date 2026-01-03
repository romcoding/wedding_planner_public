import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import api from '../../lib/api'
import { Mail, Send, CheckCircle } from 'lucide-react'

export default function Contact() {
  const { guest } = useGuestAuth()
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
      alert(error.response?.data?.error || 'Failed to send message')
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
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact Us</h2>
      <p className="text-gray-600 mb-8">
        Have a question? Need to reach out? Send us a message and we'll get back to you as soon as possible.
      </p>

      <div className="bg-white rounded-lg shadow-md p-8">
        {submitted && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Message sent successfully! We'll get back to you soon.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject *
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              required
              value={formData.subject}
              onChange={handleChange}
              placeholder="e.g., Question about accommodations"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <textarea
              id="body"
              name="body"
              required
              rows={8}
              value={formData.body}
              onChange={handleChange}
              placeholder="Write your message here..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>

          <button
            type="submit"
            disabled={sendMessage.isPending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 font-medium transition-all"
          >
            <Send className="w-5 h-5" />
            {sendMessage.isPending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  )
}

