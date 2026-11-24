import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { getApiError } from '../../lib/api'
import { parseLocalDate } from '../../lib/dates'
import { Eye, Users, Globe, TrendingUp, Calendar, FileText } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const shortDate = (value) => {
  const d = parseLocalDate(value)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : value
}

/** Turn per-day answers into a running total (households). */
export function accumulateRsvps(daily = []) {
  let confirmed = 0
  let declined = 0
  return daily.map((d) => {
    confirmed += d.confirmed || 0
    declined += d.declined || 0
    return { date: shortDate(d.date), confirmed, declined, answered: confirmed + declined }
  })
}

function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${tone}`} />
      </div>
    </div>
  )
}

const AnalyticsPage = () => {
  const [daysRange, setDaysRange] = useState(30)

  // Everything here is scoped to the couple's own wedding on the server.
  const overview = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data,
  })
  const rsvp = useQuery({
    queryKey: ['analytics', 'rsvp-progress'],
    queryFn: async () => (await api.get('/analytics/rsvp-progress')).data,
  })
  const siteStats = useQuery({
    queryKey: ['analytics', 'site-stats', daysRange],
    queryFn: async () => (await api.get(`/analytics/site-stats?days=${daysRange}`)).data,
  })

  const headcount = overview.data?.headcount || {}
  const dietary = overview.data?.dietary || {}
  const rsvpSeries = accumulateRsvps(rsvp.data?.daily)
  const viewsSeries = (siteStats.data?.daily_views || []).map((d) => ({ date: shortDate(d.date), views: d.count }))
  const topPages = (siteStats.data?.top_pages || []).slice(0, 5)
  const firstError = [overview, rsvp, siteStats].find((q) => q.error)?.error

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">How your guests are responding and who is visiting your wedding website</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <select
            aria-label="Website visits range"
            value={daysRange}
            onChange={(e) => setDaysRange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {firstError && (
        <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {getApiError(firstError, 'Could not load analytics. Please try again.')}
        </div>
      )}

      {/* Headcount (people) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Stat label="People invited" value={headcount.invited || 0} icon={Users} tone="text-blue-500" />
        <Stat label="Confirmed" value={headcount.confirmed || 0} icon={Users} tone="text-green-500" />
        <Stat label="Not responded" value={headcount.pending || 0} icon={Users} tone="text-purple-500" />
        <Stat label="Declined" value={headcount.declined || 0} icon={Users} tone="text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            RSVP progress
          </h2>
          {rsvpSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rsvpSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="confirmed" name="Confirmed households" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="declined" name="Declined households" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">No RSVPs yet</div>
          )}
          {rsvp.data && (
            <p className="text-xs text-gray-500 mt-3">
              {rsvpSeries.length ? rsvpSeries[rsvpSeries.length - 1].answered : 0} of {rsvp.data.total_guests} households have answered.
              Days are when a household was last updated.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            Dietary breakdown
          </h2>
          <div className="space-y-3">
            {[
              ['Dietary restrictions', dietary.with_restrictions],
              ['Allergies', dietary.with_allergies],
              ['Special requests', dietary.with_special_requests],
            ].map(([label, n]) => (
              <div key={label} className="flex justify-between items-center pb-3 border-b last:border-0">
                <span className="text-gray-600">{label}</span>
                <span className="font-semibold text-gray-900">{n || 0} households</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">Households that have not declined.</p>
        </div>
      </div>

      {/* Website visits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Stat label="Website page views" value={(siteStats.data?.total_views || 0).toLocaleString()} icon={Eye} tone="text-blue-500" />
        <Stat label="Unique visitors" value={(siteStats.data?.unique_visitors || 0).toLocaleString()} icon={Globe} tone="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Daily website views
          </h2>
          {viewsSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={viewsSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="views" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">No website visits recorded yet</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            Most viewed pages
          </h2>
          {topPages.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPages}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="path" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="views" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">No page view data available</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
