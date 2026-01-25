import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../lib/api'
import { Heart, Mail, User, Lock, Phone } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function GuestRegister() {
  const navigate = useNavigate()
  const { language, t } = useLanguage()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirm_password: '',
    first_name: '',
    last_name: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Validate invitation token
  const { data: invitationData, isLoading: validating } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get(`/invitations/validate/${token}`).then((res) => res.data),
    enabled: !!token,
    retry: false,
  })

  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/invitations/register', { ...data, token }),
    onSuccess: (response) => {
      const { access_token, guest } = response.data
      localStorage.setItem('guest_token', access_token)
      localStorage.setItem('guest', JSON.stringify(guest))
      navigate('/')
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Registration failed. Please try again.')
      setLoading(false)
    },
  })

  useEffect(() => {
    if (!token) {
      setError(t('guestRegisterInvalidInvitationBody'))
    }
  }, [token])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (formData.password !== formData.confirm_password) {
      setError(t('guestRegisterPasswordsNoMatch'))
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError(t('guestRegisterPasswordTooShort'))
      setLoading(false)
      return
    }

    registerMutation.mutate({
      username: formData.username,
      password: formData.password,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone,
    })
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Mail className="w-16 h-16 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('guestRegisterInvalidInvitationTitle')}</h2>
            <p className="text-gray-600 mb-6">
              {t('guestRegisterInvalidInvitationBody')}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            >
              {t('guestRegisterGoToLogin')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="text-lg">{t('guestRegisterValidating')}</div>
      </div>
    )
  }

  if (invitationData && !invitationData.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Mail className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('guestRegisterInvalidInvitationTitle')}</h2>
            <p className="text-gray-600 mb-6">
              {invitationData.error || t('guestRegisterInvalidInvitationBody')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Heart className="w-20 h-20 text-white mx-auto mb-6 drop-shadow-lg" />
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            {t('guestRegisterYoureInvited')}
          </h1>
          <p className="text-2xl md:text-3xl text-white/95 mb-2 drop-shadow-md">
            {invitationData?.guest_name
              ? t('guestRegisterDearName').replace('{{name}}', invitationData.guest_name)
              : t('guestRegisterDearGuest')}
          </p>
          <p className="text-lg md:text-xl text-white/90 drop-shadow-md">
            {t('guestRegisterHeroBody')}
          </p>
        </div>
      </div>

      {/* Registration Form */}
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('guestRegisterCompleteTitle')}</h2>
            <p className="text-gray-600 mb-4">
              {t('guestRegisterCompleteSubtitle')}
            </p>
            {invitationData?.plus_one_allowed && (
              <div className="inline-block bg-pink-50 border border-pink-200 rounded-lg px-4 py-2 mb-4">
                <p className="text-sm text-pink-700">
                  <span className="font-semibold">{t('guestRegisterPlusOneLabel')}</span>{' '}
                  {t('guestRegisterPlusOneBody')
                    .replace('{{count}}', String(invitationData.plus_one_count || 1))
                    .replace(
                      '{{plural}}',
                      (invitationData.plus_one_count || 1) !== 1 ? (language === 'de' ? 'en' : 's') : ''
                    )}
                </p>
              </div>
            )}
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('guestRegisterFirstName')}
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('guestRegisterLastName')}
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Username *
              </label>
              <input
                type="text"
                id="username"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {t('guestRegisterPhone')}
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t('guestLoginPassword')} *
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('guestRegisterPasswordHint')}</p>
            </div>

            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestRegisterConfirmPassword')}
              </label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                required
                value={formData.confirm_password}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50 font-medium text-lg transition-all"
            >
              {loading ? t('guestRegisterCreatingAccount') : t('guestRegisterCreateContinue')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

