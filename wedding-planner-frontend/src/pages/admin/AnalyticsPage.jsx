import React from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'

const AnalyticsPage = () => {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/analytics/overview').then((res) => res.data),
  })

  const { data: dietary, isLoading: dietaryLoading } = useQuery({
    queryKey: ['analytics', 'dietary'],
    queryFn: () => api.get('/analytics/dietary').then((res) => res.data),
  })

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['analytics', 'attendance'],
    queryFn: () => api.get('/analytics/attendance').then((res) => res.data),
  })

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ['analytics', 'budget'],
    queryFn: () => api.get('/analytics/budget').then((res) => res.data),
  })

  const isLoading = overviewLoading || dietaryLoading || attendanceLoading || budgetLoading

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Comprehensive analytics and insights</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Guests Overview */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Guests Overview</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">Total Guests</span>
                <span className="font-semibold text-gray-900">{overview?.guests?.total || 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">Confirmed</span>
                <span className="font-semibold text-green-600">{overview?.guests?.confirmed || 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">Pending</span>
                <span className="font-semibold text-yellow-600">{overview?.guests?.pending || 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">Declined</span>
                <span className="font-semibold text-red-600">{overview?.guests?.declined || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Attendance</span>
                <span className="font-semibold text-gray-900">{overview?.guests?.total_attendance || 0} people</span>
              </div>
            </div>
          </div>

          {/* Attendance Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Attendance Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">Ceremony Only</span>
                <span className="font-semibold">{overview?.guests?.attendance_breakdown?.ceremony_only || 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">Reception Only</span>
                <span className="font-semibold">{overview?.guests?.attendance_breakdown?.reception_only || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Both Events</span>
                <span className="font-semibold">{overview?.guests?.attendance_breakdown?.both_events || 0}</span>
              </div>
              {attendance && (
                <>
                  <div className="pt-3 mt-3 border-t">
                    <p className="text-sm text-gray-500 mb-2">RSVP Breakdown:</p>
                    {Object.entries(attendance.rsvp_breakdown || {}).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 capitalize">{status}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 mt-3 border-t">
                    <p className="text-sm text-gray-500 mb-2">Recent Registrations (7 days):</p>
                    <span className="font-semibold">{attendance.recent_registrations || 0}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dietary Requirements */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Dietary Requirements</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">With Restrictions</span>
                <span className="font-semibold">{dietary?.summary?.guests_with_restrictions || 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">With Allergies</span>
                <span className="font-semibold">{dietary?.summary?.guests_with_allergies || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Special Requests</span>
                <span className="font-semibold">{dietary?.summary?.guests_with_special_requests || 0}</span>
              </div>
              {dietary?.details && (
                <div className="pt-3 mt-3 border-t">
                  <p className="text-sm text-gray-500 mb-2">Details:</p>
                  <div className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                    {dietary.details.restrictions?.length > 0 && (
                      <div>
                        <p className="font-medium">Restrictions:</p>
                        <ul className="list-disc list-inside ml-2">
                          {dietary.details.restrictions.slice(0, 5).map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dietary.details.allergies?.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Allergies:</p>
                        <ul className="list-disc list-inside ml-2">
                          {dietary.details.allergies.slice(0, 5).map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Budget & Tasks */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Budget & Tasks</h3>
            <div className="space-y-3">
              <div className="pb-3 border-b">
                <p className="text-sm text-gray-600 mb-2">Budget:</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Planned</span>
                    <span className="font-semibold">${budget?.costs?.total_planned?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Pending</span>
                    <span className="font-semibold text-yellow-600">${budget?.costs?.total_pending?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Paid</span>
                    <span className="font-semibold text-green-600">${budget?.costs?.total_paid?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
              <div className="pt-3">
                <p className="text-sm text-gray-600 mb-2">Tasks:</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total</span>
                    <span className="font-semibold">{budget?.tasks?.total || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Completed</span>
                    <span className="font-semibold text-green-600">{budget?.tasks?.completed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">In Progress</span>
                    <span className="font-semibold text-yellow-600">{budget?.tasks?.in_progress || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className="font-semibold">
                      {budget?.tasks?.completion_rate?.toFixed(1) || '0.0'}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsPage
