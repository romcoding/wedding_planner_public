import { useQuery } from '@tanstack/react-query'
import api, { getApiError } from '../../lib/api'
import { parseLocalDate, formatLocalDate } from '../../lib/dates'
import { Calendar, Users, DollarSign, FileText, Heart, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'

const DEFAULT_CURRENCY = 'CHF'

export function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  const n = Number(amount)
  const safe = Number.isFinite(n) ? n : 0
  try {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safe)
  } catch {
    return `${currency} ${Math.round(safe)}`
  }
}

function countdownLabel(days) {
  if (days === null || days === undefined) return null
  if (days === 0) return 'Today is the day!'
  if (days === 1) return 'Tomorrow'
  if (days > 1) return `${days} days to go`
  if (days === -1) return 'Yesterday'
  return `${Math.abs(days)} days ago`
}

function Row({ label, value, valueClass = 'text-gray-900', last = false }) {
  return (
    <div className={`flex justify-between items-center ${last ? '' : 'pb-3 border-b'}`}>
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  )
}

export default function WeddingManagement() {
  // One endpoint feeds the whole screen.
  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data,
  })

  const currency = overview?.currency || DEFAULT_CURRENCY
  const money = (v) => formatMoney(v, currency)
  const headcount = overview?.headcount || {}
  const byStatus = overview?.guests?.by_status || {}
  const overnight = overview?.overnight || {}
  const dietary = overview?.dietary || {}
  const budget = overview?.budget || {}
  const hasDate = !!parseLocalDate(overview?.wedding_date)
  const countdown = countdownLabel(overview?.days_until)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Wedding Management</h1>
        <p className="text-gray-600 mt-1">Where your guests, budget and date stand today</p>
        <Link to="/admin/setup" className="mt-4 inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">
          <Wand2 className="w-4 h-4" />
          Run quick setup wizard
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {getApiError(error, 'Could not load your overview. Please try again.')}
        </div>
      )}
      {isLoading && <div className="text-gray-500 mb-6">Loading…</div>}

      {/* Wedding date + countdown */}
      <div className="bg-white rounded-lg shadow p-6 mb-8 flex items-center justify-between" data-testid="wedding-date">
        <div>
          <p className="text-sm text-gray-600">Wedding date</p>
          {hasDate ? (
            <>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatLocalDate(overview.wedding_date)}</p>
              {countdown && <p className="text-sm text-rose-600 mt-1">{countdown}</p>}
            </>
          ) : (
            !isLoading && (
              <p className="text-gray-600 mt-1">
                No date set yet.{' '}
                <Link to="/admin/setup" className="text-blue-600 underline">Set your wedding date</Link>
              </p>
            )
          )}
        </div>
        <Calendar className="w-8 h-8 text-rose-500" />
      </div>

      {/* Key Metrics (people, not rows) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">People invited</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{headcount.invited || 0}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Confirmed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{headcount.confirmed || 0}</p>
            </div>
            <Heart className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Not responded</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{headcount.pending || 0}</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Budget paid</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{money(budget.paid)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            RSVP Overview
          </h2>
          <div className="space-y-4">
            <Row label="Households confirmed" value={byStatus.confirmed || 0} valueClass="text-green-600" />
            <Row label="Households pending" value={byStatus.pending || 0} valueClass="text-yellow-600" />
            <Row label="Households declined" value={byStatus.declined || 0} valueClass="text-red-600" />
            <Row label="People attending" value={`${headcount.confirmed || 0} people`} last />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Overnight Stay
          </h2>
          <div className="space-y-4">
            <Row label="Staying overnight" value={overnight.yes || 0} valueClass="text-green-600" />
            <Row label="Not staying overnight" value={overnight.no || 0} last />
          </div>
          <p className="text-xs text-gray-500 mt-4">Counts people in confirmed households.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Dietary Requirements
          </h2>
          <div className="space-y-3">
            <Row label="With restrictions" value={dietary.with_restrictions || 0} last />
            <Row label="With allergies" value={dietary.with_allergies || 0} last />
            <Row label="Special requests" value={dietary.with_special_requests || 0} last />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Budget Overview
          </h2>
          <div className="space-y-4">
            <Row label="Planned" value={money(budget.planned)} />
            <Row label="Paid" value={money(budget.paid)} valueClass="text-green-600" />
            <Row label="Remaining" value={money(budget.remaining)} valueClass="text-orange-600" last />
          </div>
        </div>
      </div>
    </div>
  )
}
