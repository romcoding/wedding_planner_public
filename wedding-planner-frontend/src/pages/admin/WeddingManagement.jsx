import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { Calendar, MapPin, Users, DollarSign, FileText, Heart } from 'lucide-react'

export default function WeddingManagement() {
  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const response = await api.get('/analytics/overview')
      return response.data
    },
  })

  const { data: budget } = useQuery({
    queryKey: ['analytics', 'budget'],
    queryFn: async () => {
      const response = await api.get('/analytics/budget')
      return response.data
    },
  })

  const { data: dietary } = useQuery({
    queryKey: ['analytics', 'dietary'],
    queryFn: async () => {
      const response = await api.get('/analytics/dietary')
      return response.data
    },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Wedding Management</h1>
        <p className="text-gray-600 mt-1">Complete overview and process information for your wedding</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Guests</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {overview?.guests?.total || 0}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Confirmed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {overview?.guests?.confirmed || 0}
              </p>
            </div>
            <Heart className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Attendance</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {overview?.guests?.total_attendance || 0}
              </p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Budget Used</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                ${budget?.costs?.total_paid?.toLocaleString() || '0'}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RSVP Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            RSVP Overview
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Confirmed</span>
              <span className="font-semibold text-green-600">
                {overview?.guests?.confirmed || 0}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">
                {overview?.guests?.pending || 0}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Declined</span>
              <span className="font-semibold text-red-600">
                {overview?.guests?.declined || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Attendance</span>
              <span className="font-semibold text-gray-900">
                {overview?.guests?.total_attendance || 0} people
              </span>
            </div>
          </div>
        </div>

        {/* Overnight Stay Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Overnight Stay
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Staying Overnight</span>
              <span className="font-semibold text-green-600">
                {overview?.guests?.attendance_breakdown?.overnight_stay || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Not Staying Overnight</span>
              <span className="font-semibold">
                {overview?.guests?.attendance_breakdown?.no_overnight_stay || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Dietary Requirements */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Dietary Requirements
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">With Restrictions</span>
              <span className="font-semibold">
                {dietary?.summary?.guests_with_restrictions || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">With Allergies</span>
              <span className="font-semibold">
                {dietary?.summary?.guests_with_allergies || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Special Requests</span>
              <span className="font-semibold">
                {dietary?.summary?.guests_with_special_requests || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Budget Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Budget Overview
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Planned</span>
              <span className="font-semibold">
                ${budget?.costs?.total_planned?.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Paid</span>
              <span className="font-semibold text-green-600">
                ${budget?.costs?.total_paid?.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Remaining</span>
              <span className="font-semibold text-orange-600">
                ${((budget?.costs?.total_planned || 0) - (budget?.costs?.total_paid || 0)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Process Information */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Wedding Process Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Next Steps</h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Review all RSVP responses</li>
              <li>• Finalize guest count for catering</li>
              <li>• Send reminder emails to pending guests</li>
              <li>• Prepare seating arrangements</li>
              <li>• Coordinate dietary requirements with caterer</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Important Dates</h3>
            <ul className="space-y-2 text-gray-600">
              <li>• RSVP Deadline: [Set in Content Management]</li>
              <li>• Final Headcount Due: [Set in Content Management]</li>
              <li>• Wedding Date: [Set in Content Management]</li>
              <li>• Rehearsal: [Set in Content Management]</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

