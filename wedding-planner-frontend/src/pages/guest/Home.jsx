import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { Heart, Camera, Calendar, MapPin } from 'lucide-react'

// ============================================
// WEDDING PHOTOS CONFIGURATION
// ============================================
// Replace these URLs with your actual photo URLs
// You can upload photos to Imgur, Google Photos, Dropbox, etc.
// and paste the direct image URLs here
const WEDDING_PHOTOS = {
  hero: '', // Main couple photo (wide format recommended: 1920x600px)
  photo1: '', // First grid photo
  photo2: '', // Second grid photo
  photo3: '', // Third grid photo
}
// ============================================

export default function GuestHome() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    rsvp_status: 'pending',
    attendance_type: '',
    number_of_guests: 1,
    dietary_restrictions: '',
    allergies: '',
    special_requests: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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

    try {
      const response = await api.post('/guest-auth/register', formData)
      const { access_token, guest } = response.data
      
      localStorage.setItem('guest_token', access_token)
      localStorage.setItem('guest', JSON.stringify(guest))
      
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-7xl mb-6">💕</div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Thank You!</h2>
            <p className="text-xl text-gray-600 mb-8">
              Your RSVP has been received. We can't wait to celebrate with you!
            </p>
            <button
              onClick={() => navigate('/info')}
              className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 font-medium transition-all"
            >
              View Wedding Details
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Hero Section with Image Placeholders */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-pink-100/50 to-transparent"></div>
        
        {/* Couple Photo - Hero Section */}
        {WEDDING_PHOTOS.hero ? (
          <div className="relative h-96 overflow-hidden">
            <img 
              src={WEDDING_PHOTOS.hero} 
              alt="Couple Photo"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30"></div>
            {/* Header Text Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-4xl mx-auto text-center px-4">
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  We're Getting Married!
                </h1>
                <p className="text-xl text-white/90 mb-8 drop-shadow-md">
                  Please join us for our special day
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-96 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
            <div className="text-center z-10">
              <Camera className="w-16 h-16 text-white/80 mx-auto mb-4" />
              <p className="text-white/90 text-lg font-medium">Couple Photo</p>
              <p className="text-white/70 text-sm mt-2">Add your photo URL in Home.jsx</p>
            </div>
            <div className="absolute inset-0 bg-black/10"></div>
            {/* Header Text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-4xl mx-auto text-center px-4">
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
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

      {/* Additional Photo Placeholders */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="relative h-64 bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-12 h-12 text-white/80 mx-auto mb-2" />
              <p className="text-white/90 text-sm">Photo 1</p>
            </div>
          </div>
          <div className="relative h-64 bg-gradient-to-br from-purple-200 to-pink-200 rounded-2xl overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-12 h-12 text-white/80 mx-auto mb-2" />
              <p className="text-white/90 text-sm">Photo 2</p>
            </div>
          </div>
          <div className="relative h-64 bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-12 h-12 text-white/80 mx-auto mb-2" />
              <p className="text-white/90 text-sm">Photo 3</p>
            </div>
          </div>
        </div>

        {/* RSVP Form */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <div className="text-center mb-8">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">RSVP</h2>
              <p className="text-gray-600">
                Please fill out the form below to confirm your attendance
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Authentication Fields */}
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
                    <label htmlFor="attendance_type" className="block text-sm font-medium text-gray-700 mb-2">
                      Attendance
                    </label>
                    <select
                      id="attendance_type"
                      name="attendance_type"
                      value={formData.attendance_type}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="">Select...</option>
                      <option value="ceremony">Ceremony Only</option>
                      <option value="reception">Reception Only</option>
                      <option value="both">Both Events</option>
                    </select>
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
                {loading ? 'Submitting...' : 'Submit RSVP'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

