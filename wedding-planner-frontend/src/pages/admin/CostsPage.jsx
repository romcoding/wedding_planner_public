import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash } from 'lucide-react'

const CostsPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    category: '',
    status: 'planned',
    payment_date: '',
    vendor: '',
    notes: '',
  })

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costs'],
    queryFn: () => api.get('/costs').then((res) => res.data),
  })

  const createCost = useMutation({
    mutationFn: (payload) => api.post('/costs', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['costs'])
      setShowForm(false)
      setFormData({
        name: '',
        description: '',
        amount: '',
        category: '',
        status: 'planned',
        payment_date: '',
        vendor: '',
        notes: '',
      })
    },
  })

  const updateCost = useMutation({
    mutationFn: ({ id, data }) => api.put(`/costs/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries(['costs']),
  })

  const deleteCost = useMutation({
    mutationFn: (id) => api.delete(`/costs/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['costs']),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...formData, amount: parseFloat(formData.amount || 0) }
    createCost.mutate(payload)
  }

  const handleUpdate = (id, field, value) => {
    const data = field === 'amount' ? { [field]: parseFloat(value || 0) } : { [field]: value }
    updateCost.mutate({ id, data })
  }

  const planned = costs?.filter((c) => c.status === 'planned').reduce((s, c) => s + (c.amount || 0), 0) || 0
  const pending = costs?.filter((c) => c.status === 'pending').reduce((s, c) => s + (c.amount || 0), 0) || 0
  const paid = costs?.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0) || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Costs</h1>
          <p className="text-gray-600 mt-1">Track your wedding budget and expenses</p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="h-5 w-5" />
          <span>Add Cost</span>
        </button>
      </div>

      {/* Budget Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Total Planned</p>
          <p className="text-2xl font-bold text-gray-900">${planned.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Total Pending</p>
          <p className="text-2xl font-bold text-yellow-600">${pending.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">${paid.toFixed(2)}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Amount *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Venue, Catering"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="planned">Planned</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Payment Date</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Vendor</label>
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Create Cost
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading costs...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {costs?.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      No costs yet. Add your first cost item!
                    </td>
                  </tr>
                ) : (
                  costs?.map((cost) => (
                    <tr key={cost.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{cost.name}</div>
                        {cost.description && (
                          <div className="text-xs text-gray-500 mt-1">{cost.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${parseFloat(cost.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cost.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={cost.status}
                          onChange={(e) => handleUpdate(cost.id, 'status', e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="planned">Planned</option>
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cost.payment_date ? new Date(cost.payment_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cost.vendor || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => deleteCost.mutate(cost.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default CostsPage
