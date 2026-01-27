import { useState } from 'react'
import api from '../../lib/api'

export default function GuestRegistration() {
  const [formData, setFormData] = useState({
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
      await api.post('/guests/register', formData)
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h2>
          <p className="text-gray-600 mb-6">
            Your RSVP has been received. We'll be in touch with more details soon.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="px-6 py-2 text-white rounded-lg hover:opacity-90"
            style={{ backgroundColor: 'var(--wp-primary)' }}
          >
            Update Information
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Wedding RSVP</h1>
        <p className="text-gray-600 mb-8">
          Please fill out the form below to confirm your attendance
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="attendance_type" className="block text-sm font-medium text-gray-700 mb-2">
              Attendance
            </label>
            <select
              id="attendance_type"
              name="attendance_type"
              value={formData.attendance_type}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select...</option>
              <option value="ceremony">Ceremony Only</option>
              <option value="reception">Reception Only</option>
              <option value="both">Both Events</option>
            </select>
          </div>

          <div>
            <label htmlFor="number_of_guests" className="block text-sm font-medium text-gray-700 mb-2">
              Number of Guests (Including Yourself)
            </label>
            <input
              type="number"
              id="number_of_guests"
              name="number_of_guests"
              min="1"
              value={formData.number_of_guests}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="special_requests" className="block text-sm font-medium text-gray-700 mb-2">
              Special Requests or Notes
            </label>
            <textarea
              id="special_requests"
              name="special_requests"
              rows="3"
              value={formData.special_requests}
              onChange={handleChange}
              placeholder="Any special requests or additional information"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 text-white rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 font-medium"
            style={{ backgroundColor: 'var(--wp-primary)' }}
          >
            {loading ? 'Submitting...' : 'Submit RSVP'}
          </button>
        </form>
      </div>
    </div>
  )
}

