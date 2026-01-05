import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import api from '../../lib/api'
import { Heart, Camera, Music, Edit } from 'lucide-react'
import GlitterAnimation from '../../components/GlitterAnimation'

export default function GuestHome() {
  const { guest } = useGuestAuth()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    rsvp_status: 'pending',
    overnight_stay: false,
    number_of_guests: 1,
    dietary_restrictions: '',
    allergies: '',
    special_requests: '',
    music_wish: '',
  })
  const [isEditing, setIsEditing] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showGlitter, setShowGlitter] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch guest profile if logged in
  const { data: guestProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['guest-profile'],
    queryFn: () => api.get('/guest-auth/profile').then((res) => res.data),
    enabled: !!guest,
    retry: false,
  })

  // Fetch images from API
  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  // Populate form with guest data if logged in
  useEffect(() => {
    if (guestProfile) {
      setFormData({
        username: guestProfile.username || '',
        password: '', // Don't populate password
        first_name: guestProfile.first_name || '',
        last_name: guestProfile.last_name || '',
        email: guestProfile.email || '',
        phone: guestProfile.phone || '',
        rsvp_status: guestProfile.rsvp_status || 'pending',
        overnight_stay: guestProfile.overnight_stay || false,
        number_of_guests: guestProfile.number_of_guests || 1,
        dietary_restrictions: guestProfile.dietary_restrictions || '',
        allergies: guestProfile.allergies || '',
        special_requests: guestProfile.special_requests || '',
        music_wish: guestProfile.music_wish || '',
      })
      setIsEditing(true)
    }
  }, [guestProfile])

  // Get images by position
  const heroImage = images?.find(img => img.position === 'hero' && img.is_active && img.is_public)
  const rsvpImages = images?.filter(img => 
    ['photo1', 'photo2', 'photo3'].includes(img.position) && img.is_active && img.is_public
  ).sort((a, b) => a.order - b.order).slice(0, 3)

  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/guest-auth/profile', data),
    onSuccess: () => {
      setShowGlitter(true)
      setSubmitted(true)
      setTimeout(() => {
        navigate('/info')
      }, 3000)
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Update failed. Please try again.')
      setLoading(false)
    },
  })

  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/guest-auth/register', data),
    onSuccess: (response) => {
      const { access_token, guest } = response.data
      localStorage.setItem('guest_token', access_token)
      localStorage.setItem('guest', JSON.stringify(guest))
      setShowGlitter(true)
      setSubmitted(true)
      setTimeout(() => {
        navigate('/info')
      }, 3000)
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
      setLoading(false)
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'number_of_guests' ? parseInt(value) || 1 : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isEditing && guest) {
      // Update existing RSVP
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        rsvp_status: formData.rsvp_status,
        overnight_stay: formData.overnight_stay,
        number_of_guests: formData.number_of_guests,
        dietary_restrictions: formData.dietary_restrictions,
        allergies: formData.allergies,
        special_requests: formData.special_requests,
        music_wish: formData.music_wish,
      }
      updateMutation.mutate(updateData)
    } else {
      // New registration
      registerMutation.mutate(formData)
    }
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <GlitterAnimation show={showGlitter} onComplete={() => setShowGlitter(false)} />
      
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
                  We're Getting Married!
                </h1>
                <p className="text-xl text-white/90 mb-8 drop-shadow-md">
                  Please join us for our special day
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-64 md:h-96 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
            <div className="text-center z-10">
              <Camera className="w-16 h-16 text-white/80 mx-auto mb-4" />
              <p className="text-white/90 text-lg font-medium">Couple Photo</p>
            </div>
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-4xl mx-auto text-center px-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  We're Getting Married!
                </h1>
                <p className="text-xl text-white/90 mb-8 drop-shadow-md">
                  Please join us for our special day
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
            <div className="space-y-4">
              {rsvpImages && rsvpImages.length > 0 ? (
                rsvpImages.map((image, index) => (
                  <div key={image.id} className="relative h-64 rounded-2xl overflow-hidden shadow-lg">
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
                      className="relative h-64 bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl overflow-hidden flex items-center justify-center"
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
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  {isEditing ? 'Update Your RSVP' : 'RSVP'}
                </h2>
                <p className="text-gray-600">
                  {isEditing 
                    ? 'Update your information below' 
                    : 'Please fill out the form below to confirm your attendance'}
                </p>
                {isEditing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600">
                    <Edit className="w-4 h-4" />
                    <span>You can update your RSVP at any time</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Authentication Fields - Only show for new registrations */}
                {!isEditing && (
                  <div className="border-b border-gray-200 pb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
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
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                          Password *
                        </label>
                        <input
                          type="password"
                          id="password"
                          name="password"
                          required
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Personal Information */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
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
                        Last Name *
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {!isEditing && (
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                        />
                      </div>
                    )}
                    {isEditing && (
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          disabled
                          value={formData.email}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                      </div>
                    )}
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
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
                  </div>
                </div>

                {/* RSVP Details */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">RSVP Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="overnight_stay" className="block text-sm font-medium text-gray-700 mb-2">
                        Overnight Stay
                      </label>
                      <select
                        id="overnight_stay"
                        name="overnight_stay"
                        value={formData.overnight_stay ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, overnight_stay: e.target.value === 'true' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      >
                        <option value="false">No, I would not like to stay overnight</option>
                        <option value="true">Yes, I would like to stay overnight</option>
                      </select>
                      <p className="mt-2 text-xs text-gray-500 italic">
                        You need to arrange accommodation yourselves.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="number_of_guests" className="block text-sm font-medium text-gray-700 mb-2">
                        Number of Guests
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
                      RSVP Status
                    </label>
                    <select
                      id="rsvp_status"
                      name="rsvp_status"
                      value={formData.rsvp_status}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="declined">Declined</option>
                    </select>
                  </div>
                </div>

                {/* Music Wish */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Music className="w-5 h-5 text-pink-500" />
                    Music Wish
                  </h3>
                  <div>
                    <label htmlFor="music_wish" className="block text-sm font-medium text-gray-700 mb-2">
                      Song Requests
                    </label>
                    <textarea
                      id="music_wish"
                      name="music_wish"
                      rows="3"
                      value={formData.music_wish}
                      onChange={handleChange}
                      placeholder="What songs would you like to hear at the wedding?"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Dietary Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Dietary Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="dietary_restrictions" className="block text-sm font-medium text-gray-700 mb-2">
                        Dietary Restrictions
                      </label>
                      <textarea
                        id="dietary_restrictions"
                        name="dietary_restrictions"
                        rows="3"
                        value={formData.dietary_restrictions}
                        onChange={handleChange}
                        placeholder="e.g., Vegetarian, Vegan, Gluten-free"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-2">
                        Allergies
                      </label>
                      <textarea
                        id="allergies"
                        name="allergies"
                        rows="3"
                        value={formData.allergies}
                        onChange={handleChange}
                        placeholder="Please list any food allergies"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="special_requests" className="block text-sm font-medium text-gray-700 mb-2">
                        Special Requests
                      </label>
                      <textarea
                        id="special_requests"
                        name="special_requests"
                        rows="3"
                        value={formData.special_requests}
                        onChange={handleChange}
                        placeholder="Any special requests or additional information"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50 font-medium text-lg transition-all"
                >
                  {loading ? 'Saving...' : isEditing ? 'Update RSVP' : 'Submit RSVP'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
