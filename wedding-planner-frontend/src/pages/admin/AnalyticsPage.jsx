import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { Activity, Eye, Shield, AlertTriangle, TrendingUp, Users, Globe, Clock, Calendar } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const AnalyticsPage = () => {
  const [daysRange, setDaysRange] = useState(30)
  
  const { data: siteStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['analytics', 'site-stats', daysRange],
    queryFn: async () => {
      const res = await api.get(`/analytics/site-stats?days=${daysRange}`)
      return res.data
    },
  })

  const { data: securityEvents, isLoading: isLoadingSecurity } = useQuery({
    queryKey: ['analytics', 'security', daysRange],
    queryFn: async () => {
      const res = await api.get(`/analytics/security?days=${daysRange}`)
      return res.data
    },
  })

  const chartData = siteStats?.daily_visits?.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    visits: item.count
  })) || []

  const topPagesData = siteStats?.top_pages?.slice(0, 5).map(page => ({
    path: page.path.length > 30 ? page.path.substring(0, 30) + '...' : page.path,
    views: page.views
  })) || []

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Technical Analytics</h1>
          <p className="text-gray-600 mt-1">Site visits, security monitoring, and system performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <select
            value={daysRange}
            onChange={(e) => setDaysRange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {isLoadingStats && (
        <div className="text-center py-8 text-gray-500">Loading analytics data...</div>
      )}

      {/* Site Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Visits</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {siteStats?.total_visits?.toLocaleString() || '0'}
              </p>
            </div>
            <Eye className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unique Visitors</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {siteStats?.unique_visitors?.toLocaleString() || '0'}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Page Views</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {siteStats?.page_views?.toLocaleString() || '0'}
              </p>
            </div>
            <Globe className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg. Session</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {siteStats?.avg_session_duration ? `${Math.round(siteStats.avg_session_duration / 60)}m` : '0m'}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Security Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Security Events
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Failed Login Attempts</span>
              <span className="font-semibold text-red-600">
                {securityEvents?.failed_logins || 0}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Blocked Requests</span>
              <span className="font-semibold text-orange-600">
                {securityEvents?.blocked_requests || 0}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Rate Limit Hits</span>
              <span className="font-semibold text-yellow-600">
                {securityEvents?.rate_limit_hits || 0}
              </span>
            </div>
            {securityEvents?.suspicious_ips && securityEvents.suspicious_ips.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Suspicious IPs:</p>
                <div className="space-y-1">
                  {securityEvents.suspicious_ips.slice(0, 5).map((ip, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="font-mono text-gray-600">{ip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500" />
            Performance Metrics
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Bounce Rate</span>
              <span className="font-semibold">
                {siteStats?.bounce_rate ? `${siteStats.bounce_rate.toFixed(1)}%` : '0%'}
              </span>
            </div>
            {securityEvents?.events_by_type && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Events by Type:</p>
                <div className="space-y-1">
                  {Object.entries(securityEvents.events_by_type).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Daily Visits
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visits" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">No visit data available</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            Top Pages
          </h2>
          {topPagesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPagesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="path" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="views" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">No page view data available</div>
          )}
        </div>
      </div>

      {/* Recent Security Events */}
      {securityEvents?.recent_events && securityEvents.recent_events.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            Recent Security Events
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {securityEvents.recent_events.slice(0, 10).map((event) => (
                  <tr key={event.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(event.occurred_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                      {event.event_type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {event.ip_address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        event.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        event.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        event.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {event.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsPage
