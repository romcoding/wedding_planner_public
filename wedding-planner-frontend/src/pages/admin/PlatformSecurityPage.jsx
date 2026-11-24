import { useQuery } from '@tanstack/react-query'
import api, { getApiError } from '../../lib/api'
import { Shield } from 'lucide-react'

const SEVERITY = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
}

/**
 * Platform-wide security log. Platform administrators only: routed behind
 * `platformAdminOnly` and backed by require_platform_admin on the server.
 * Not part of any couple's analytics.
 */
export default function PlatformSecurityPage() {
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['platform', 'security-events'],
    queryFn: async () => (await api.get('/analytics/security')).data,
  })

  const byType = events.reduce((acc, e) => ({ ...acc, [e.event_type]: (acc[e.event_type] || 0) + 1 }), {})

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-blue-500" />
          Platform security
        </h1>
        <p className="text-gray-600 mt-1">The 100 most recent security events across the platform</p>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {getApiError(error, 'Could not load security events.')}
        </div>
      )}
      {isLoading && <div className="text-gray-500">Loading…</div>}

      {!isLoading && !error && events.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-gray-500">No security events recorded.</div>
      )}

      {events.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">By type</h2>
            <div className="space-y-1">
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-gray-600 capitalize">{type.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Time', 'Type', 'IP address', 'Severity'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.created_at}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">{(e.event_type || '').replace(/_/g, ' ')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{e.ip_address || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${SEVERITY[e.severity] || 'bg-green-100 text-green-800'}`}>
                        {e.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
