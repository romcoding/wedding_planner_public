import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { Users, CheckSquare, DollarSign, TrendingUp } from 'lucide-react'

export default function AdminDashboard() {
  const BASE_CURRENCY = 'CHF'
  const formatMoney = (amount, currency = BASE_CURRENCY) => {
    const n = Number(amount || 0)
    try {
      return new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number.isFinite(n) ? n : 0)
    } catch {
      const safe = Number.isFinite(n) ? n : 0
      return `${currency} ${Math.round(safe)}`
    }
  }

  const { data: overview, isLoading } = useQuery({
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

  if (isLoading) {
    return <div>Loading...</div>
  }

  const stats = [
    {
      label: 'Total Guests',
      value: overview?.guests?.total || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: 'Confirmed',
      value: overview?.guests?.confirmed || 0,
      icon: Users,
      color: 'bg-green-500',
    },
    {
      label: 'Pending RSVPs',
      value: overview?.guests?.pending || 0,
      icon: CheckSquare,
      color: 'bg-yellow-500',
    },
    {
      label: 'Total Budget',
      value: formatMoney(budget?.costs?.total_planned || 0),
      icon: DollarSign,
      color: 'bg-purple-500',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-full`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">RSVP Status</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Confirmed</span>
              <span className="font-semibold text-green-600">
                {overview?.guests?.confirmed || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">
                {overview?.guests?.pending || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Declined</span>
              <span className="font-semibold text-red-600">
                {overview?.guests?.declined || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Budget Overview</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Planned</span>
              <span className="font-semibold text-gray-900">
                {formatMoney(budget?.costs?.total_planned || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Paid</span>
              <span className="font-semibold text-green-600">
                {formatMoney(budget?.costs?.total_paid || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">
                {formatMoney(budget?.costs?.total_pending || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

