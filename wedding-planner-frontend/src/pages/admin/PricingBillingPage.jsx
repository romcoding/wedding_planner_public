import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'

export default function PricingBillingPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', 'overview'],
    queryFn: () => api.get('/subscriptions').then((r) => r.data),
  })

  const topUp = useMutation({
    mutationFn: (tokens) => api.post('/subscriptions/top-up', { tokens }),
    onSuccess: () => queryClient.invalidateQueries(['subscriptions', 'overview']),
  })

  const upgrade = useMutation({
    mutationFn: (plan_type) => api.post('/subscriptions/upgrade', { plan_type }),
    onSuccess: () => queryClient.invalidateQueries(['subscriptions', 'overview']),
  })

  if (isLoading) return <div className="p-6">Loading billing details...</div>

  const subscription = data?.subscription || {}
  const plans = data?.plans || []
  const usage = data?.usage_history || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Pricing & Billing</h1>
        <p className="text-gray-600 mt-1">AI features consume tokens. Free features remain unlimited.</p>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-lg font-semibold">Current Plan</h2>
        <p className="text-sm text-gray-600 mt-1">Plan: <strong>{subscription.plan_type || 'free'}</strong></p>
        <p className="text-sm text-gray-600">Token balance: <strong>{subscription.balance_tokens ?? 0}</strong></p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => topUp.mutate(500)} className="px-3 py-2 rounded bg-blue-600 text-white">Top up +500</button>
          <button onClick={() => topUp.mutate(2000)} className="px-3 py-2 rounded bg-indigo-600 text-white">Top up +2000</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.plan_type} className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold">{plan.label}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {plan.unlimited ? 'Unlimited tokens' : `${plan.monthly_tokens} tokens/month`}
            </p>
            <button
              onClick={() => upgrade.mutate(plan.plan_type)}
              className="mt-3 px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
            >
              Upgrade
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Usage History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Feature</th>
                <th className="py-2 pr-4">Tokens</th>
                <th className="py-2 pr-4">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">{item.feature}</td>
                  <td className="py-2 pr-4">{item.tokens_consumed}</td>
                  <td className="py-2 pr-4">{Number(item.total_cost || 0).toFixed(4)}</td>
                </tr>
              ))}
              {usage.length === 0 && (
                <tr>
                  <td className="py-3 text-gray-500" colSpan={4}>No AI usage yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
