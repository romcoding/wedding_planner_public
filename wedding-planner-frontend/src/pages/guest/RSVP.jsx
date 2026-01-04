import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import api from '../../lib/api'
import { Heart, Camera, Music, Loader } from 'lucide-react'
import GlitterAnimation from '../../components/GlitterAnimation'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default function RSVP() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { guest, loginWithToken } = useGuestAuth()
  const { t, setLanguage } = useLanguage()
  const [showGlitter, setShowGlitter] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch guest data by token
  const { data: guestData, isLoading: loadingGuest } = useQuery({
    queryKey: ['guest-by-token', token],
    queryFn: () => api.get(`/guests/token/${token}`).then((res) => res.data),
    enabled: !!token,
    retry: false,
  })

  // Authenticate with token
  const authMutation = useMutation({
    mutationFn: () => api.post(`/guests/token/${token}/auth`),
    onSuccess: (response) => {
      const { access_token, guest: guestInfo } = response.data
      loginWithToken(access_token, guestInfo)
      setLoading(false)
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to authenticate')
      setLoading(false)
    },
  })

  // Auto-authenticate when guest data is loaded
  useEffect(() => {
    if (guestData && !guest) {
      authMutation.mutate()
    } else if (guestData) {
      setLoading(false)
    }
  }, [guestData, guest])

  // RSVP form data
  const [formData, setFormData] = useState({
    rsvp_status: 'pending',
    attendance_type: '',
    number_of_guests: 1,
    dietary_restrictions: '',
    allergies: '',
    special_requests: '',
    music_wish: '',
    phone: '',
    address: '',
  })

  // Populate form when guest data loads
  useEffect(() => {
    if (guestData) {
      setFormData({
        rsvp_status: guestData.rsvp_status || 'pending',
        attendance_type: guestData.attendance_type || '',
        number_of_guests: guestData.number_of_guests || 1,
        dietary_restrictions: guestData.dietary_restrictions || '',
        allergies: guestData.allergies || '',
        special_requests: guestData.special_requests || '',
        music_wish: guestData.music_wish || '',
        phone: guestData.phone || '',
        address: guestData.address || '',
      })
      // Set language from guest data if available
      if (guestData.language) {
        setLanguage(guestData.language)
      }
    }
  }, [guestData, setLanguage])

  // Fetch images
  const { data: images } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  const updateRSVPMutation = useMutation({
    mutationFn: (data) => api.put('/guests/update-rsvp', data),
    onSuccess: () => {
      setShowGlitter(true)
      setTimeout(() => {
        navigate('/info')
      }, 3000)
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update RSVP')
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'number_of_guests' ? parseInt(value) || 1 : value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    updateRSVPMutation.mutate(formData)
  }

  // Get images
  const heroImage = images?.find(img => img.position === 'hero' && img.is_active && img.is_public)
  const rsvpImages = images?.filter(img => 
    ['photo1', 'photo2', 'photo3'].includes(img.position) && img.is_active && img.is_public
  ).sort((a, b) => a.order - b.order).slice(0, 3)

  if (loading || loadingGuest || authMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="text-center">
          <Loader className="w-12 h-12 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('loadingRSVP')}</p>
        </div>
      </div>
    )
  }

  if (!guestData || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('invalidLink')}</h2>
            <p className="text-gray-600 mb-6">
              {error || t('invalidLinkMessage')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <GlitterAnimation show={showGlitter} onComplete={() => setShowGlitter(false)} />
      
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {heroImage ? (
          <div className="relative h-64 md:h-96 overflow-hidden">
            <img 
              src={heroImage.url} 
              alt={heroImage.alt_text || 'Couple Photo'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-4xl mx-auto text-center px-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  {t('welcome')}, {guestData.first_name}!
                </h1>
                <p className="text-xl text-white/90 mb-8 drop-shadow-md">
                  {t('confirmAttendance')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-64 md:h-96 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-4xl mx-auto text-center px-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  {t('welcome')}, {guestData.first_name}!
                </h1>
                <p className="text-xl text-white/90 mb-8 drop-shadow-md">
                  {t('confirmAttendance')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content: Images Left, Form Right */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side: Images */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('ourStory')}</h2>
            <div className="space-y-4">
              {rsvpImages && rsvpImages.length > 0 ? (
                rsvpImages.map((image, index) => (
                  <div key={image.id} className="relative rounded-2xl overflow-hidden shadow-lg" style={{ aspectRatio: '21/29' }}>
                    <img
                      src={image.url}
                      alt={image.alt_text || `Wedding Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))
              ) : (
                <>
                  {[1, 2, 3].map((num) => (
                    <div
                      key={num}
                      className="relative bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl overflow-hidden flex items-center justify-center"
                      style={{ aspectRatio: '21/29' }}
                    >
                      <div className="text-center">
                        <Camera className="w-12 h-12 text-white/80 mx-auto mb-2" />
                        <p className="text-white/90 text-sm">Photo {num}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Right Side: RSVP Form */}
          <div>
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 sticky top-8">
              <div className="text-center mb-8">
                <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('rsvp')}</h2>
                <p className="text-gray-600 mb-4">
                  {t('hi')} {guestData.first_name}! {t('fillForm')}
                </p>
                <div className="bg-pink-50 border-l-4 border-pink-500 p-4 rounded-r-lg text-left">
                  <p className="text-gray-700 leading-relaxed">
                    {t('introduction')}
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* RSVP Details */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('rsvpDetails')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="attendance_type" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('attendance')}
                      </label>
                      <select
                        id="attendance_type"
                        name="attendance_type"
                        value={formData.attendance_type}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      >
                        <option value="">{t('select')}</option>
                        <option value="ceremony">{t('ceremonyOnly')}</option>
                        <option value="reception">{t('receptionOnly')}</option>
                        <option value="both">{t('bothEvents')}</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="number_of_guests" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('numberOfGuests')}
                      </label>
                      <input
                        type="number"
                        id="number_of_guests"
                        name="number_of_guests"
                        min="1"
                        value={formData.number_of_guests}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="rsvp_status" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('rsvpStatus')}
                    </label>
                    <select
                      id="rsvp_status"
                      name="rsvp_status"
                      value={formData.rsvp_status}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="pending">{t('pending')}</option>
                      <option value="confirmed">{t('confirmed')}</option>
                      <option value="declined">{t('declined')}</option>
                    </select>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('contactInfo')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('phone')}
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
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('address')}
                      </label>
                      <input
                        type="text"
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Music Wish */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Music className="w-5 h-5 text-pink-500" />
                    {t('musicWish')}
                  </h3>
                  <div>
                    <label htmlFor="music_wish" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('songRequests')}
                    </label>
                    <textarea
                      id="music_wish"
                      name="music_wish"
                      rows="3"
                      value={formData.music_wish}
                      onChange={handleChange}
                      placeholder={t('musicPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Dietary Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dietaryInfo')}</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="dietary_restrictions" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('dietaryRestrictions')}
                      </label>
                      <textarea
                        id="dietary_restrictions"
                        name="dietary_restrictions"
                        rows="3"
                        value={formData.dietary_restrictions}
                        onChange={handleChange}
                        placeholder={t('dietaryPlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('allergies')}
                      </label>
                      <textarea
                        id="allergies"
                        name="allergies"
                        rows="3"
                        value={formData.allergies}
                        onChange={handleChange}
                        placeholder={t('allergiesPlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="special_requests" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('specialRequests')}
                      </label>
                      <textarea
                        id="special_requests"
                        name="special_requests"
                        rows="3"
                        value={formData.special_requests}
                        onChange={handleChange}
                        placeholder={t('specialPlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updateRSVPMutation.isPending}
                  className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50 font-medium text-lg transition-all"
                >
                  {updateRSVPMutation.isPending ? t('saving') : t('submitRSVP')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

