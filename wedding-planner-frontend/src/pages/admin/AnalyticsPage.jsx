import React from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { Activity, Eye, Shield, AlertTriangle, TrendingUp, Users, Globe, Clock } from 'lucide-react'

const AnalyticsPage = () => {
  // TODO: Implement actual technical analytics endpoints
  // For now, showing placeholder structure
  
  const { data: siteStats } = useQuery({
    queryKey: ['analytics', 'site-stats'],
    queryFn: async () => {
      // Placeholder - implement actual endpoint
      return {
        total_visits: 0,
        unique_visitors: 0,
        page_views: 0,
        avg_session_duration: 0,
        bounce_rate: 0,
      }
    },
  })

  const { data: securityEvents } = useQuery({
    queryKey: ['analytics', 'security'],
    queryFn: async () => {
      // Placeholder - implement actual endpoint
      return {
        failed_logins: 0,
        suspicious_ips: [],
        blocked_requests: 0,
        rate_limit_hits: 0,
      }
    },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Technical Analytics</h1>
        <p className="text-gray-600 mt-1">Site visits, security monitoring, and system performance</p>
      </div>

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
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">API Response Time</span>
              <span className="font-semibold text-green-600">
                {'< 200ms'} {/* Placeholder */}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Uptime</span>
              <span className="font-semibold text-green-600">
                99.9% {/* Placeholder */}
              </span>
            </div>
            <div className="pt-3 border-t">
              <p className="text-sm text-gray-500 mb-2">Note: Full analytics implementation pending</p>
              <p className="text-xs text-gray-400">
                This section will show real-time technical metrics once tracking is implemented.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-500" />
          Recent Activity
        </h2>
        <div className="text-center py-8 text-gray-500">
          <p>Activity timeline will be displayed here</p>
          <p className="text-sm mt-2">Implementation pending</p>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
