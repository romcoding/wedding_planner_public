import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, AlertTriangle, Upload, FileText, X } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useToast } from '../../components/ui/Toast'

const CATEGORIES = [
  'Venue',
  'Catering',
  'Dress',
  'Photography',
  'Music',
  'Décor',
  'Flowers',
  'Transportation',
  'Hair & Makeup',
  'Invitations',
  'Other'
]

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0', '#FFB347']

const CostsPage = () => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'EUR',
    category: '',
    status: 'planned',
    payment_date: '',
    vendor_name: '',
    vendor_contact: '',
    receipt_url: '',
    notes: '',
    is_recurring: false,
    recurring_frequency: '',
  })

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costs'],
    queryFn: () => api.get('/costs').then((res) => res.data),
  })

  const { data: analytics } = useQuery({
    queryKey: ['cost-analytics'],
    queryFn: () => api.get('/costs/analytics').then((res) => res.data),
  })

  const [fieldErrors, setFieldErrors] = useState({})

  const createCost = useMutation({
    mutationFn: (payload) => api.post('/costs', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['costs'])
      queryClient.invalidateQueries(['cost-analytics'])
      resetForm()
      setShowForm(false)
      setFieldErrors({})
      toast.success('Cost created successfully!')
    },
    onError: (error) => {
      console.error('Error creating cost:', error)
      const errorData = error.response?.data
      if (errorData?.errors) {
        setFieldErrors(errorData.errors)
      } else {
        const errorMsg = errorData?.error || 'Failed to create cost. Please check all required fields and ensure amount is a valid number.'
        setFieldErrors({ general: errorMsg })
        toast.error(errorMsg)
      }
    },
  })

  const updateCost = useMutation({
    mutationFn: ({ id, data }) => api.put(`/costs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['costs'])
      queryClient.invalidateQueries(['cost-analytics'])
      resetForm()
      setShowForm(false)
      setFieldErrors({})
      toast.success('Cost updated successfully!')
    },
    onError: (error) => {
      console.error('Error updating cost:', error)
      const errorData = error.response?.data
      const errorMsg = errorData?.error || 'Failed to update cost. Please try again.'
      setFieldErrors({ general: errorMsg })
      toast.error(errorMsg)
    },
  })

  const deleteCost = useMutation({
    mutationFn: (id) => api.delete(`/costs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['costs'])
      queryClient.invalidateQueries(['cost-analytics'])
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      amount: '',
      currency: 'EUR',
      category: '',
      status: 'planned',
      payment_date: '',
      vendor_name: '',
      vendor_contact: '',
      receipt_url: '',
      notes: '',
      is_recurring: false,
      recurring_frequency: '',
    })
    setEditingId(null)
  }

  const handleEdit = (cost) => {
    setEditingId(cost.id)
    setFormData({
      name: cost.name || '',
      description: cost.description || '',
      amount: cost.amount || '',
      currency: cost.currency || 'EUR',
      category: cost.category || '',
      status: cost.status || 'planned',
      payment_date: cost.payment_date ? new Date(cost.payment_date).toISOString().split('T')[0] : '',
      vendor_name: cost.vendor_name || cost.vendor || '',
      vendor_contact: cost.vendor_contact || '',
      receipt_url: cost.receipt_url || '',
      notes: cost.notes || '',
      is_recurring: cost.is_recurring || false,
      recurring_frequency: cost.recurring_frequency || '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFieldErrors({})
    
    // Validate required fields
    const errors = {}
    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Cost name is required'
    }
    if (!formData.amount || formData.amount === '') {
      errors.amount = 'Amount is required'
    } else {
      const amountNum = parseFloat(formData.amount)
      if (isNaN(amountNum) || amountNum <= 0) {
        errors.amount = 'Amount must be a valid number greater than 0'
      }
    }
    if (!formData.category || formData.category === '') {
      errors.category = 'Category is required'
    }
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    
    const payload = {
      ...formData,
      amount: parseFloat(formData.amount),  // Ensure it's a number, not string
      vendor: formData.vendor_name,  // For backward compatibility
      payment_date: formData.payment_date || null,
    }
    
    if (editingId) {
      updateCost.mutate({ id: editingId, data: payload })
    } else {
      createCost.mutate(payload)
    }
  }

  const handleUpdate = (id, field, value) => {
    const data = field === 'amount' ? { [field]: parseFloat(value || 0) } : { [field]: value }
    updateCost.mutate({ id, data })
  }

  const planned = costs?.filter((c) => c.status === 'planned').reduce((s, c) => s + (c.amount || 0), 0) || 0
  const pending = costs?.filter((c) => c.status === 'pending').reduce((s, c) => s + (c.amount || 0), 0) || 0
  const paid = costs?.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0) || 0

  // Prepare chart data
  const categoryData = analytics?.by_category ? Object.entries(analytics.by_category).map(([category, totals]) => ({
    name: category,
    planned: totals.planned,
    paid: totals.paid,
    pending: totals.pending,
    total: totals.total
  })) : []

  const pieData = categoryData.map((item, index) => ({
    name: item.name,
    value: item.total,
    color: COLORS[index % COLORS.length]
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget & Costs</h1>
          <p className="text-gray-600 mt-1">Track your wedding budget and expenses</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="h-5 w-5" />
          <span>Add Cost</span>
        </button>
      </div>

      {/* Budget Summary Cards */}
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

      {/* Budget Alerts */}
      {analytics?.alerts && analytics.alerts.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">Budget Alerts</h3>
          </div>
          <div className="space-y-2">
            {analytics.alerts.map((alert, index) => (
              <div key={index} className="text-sm text-yellow-700">
                <strong>{alert.category}:</strong> {alert.percentage}% of planned budget spent ({alert.spent.toFixed(2)} / {alert.planned.toFixed(2)})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Charts */}
      {categoryData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="planned" fill="#8884d8" name="Planned" />
                <Bar dataKey="paid" fill="#82ca9d" name="Paid" />
                <Bar dataKey="pending" fill="#ffc658" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              resetForm()
              setShowForm(false)
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingId ? 'Edit Cost' : 'Add New Cost'}
                </h2>
                <button
                  onClick={() => {
                    resetForm()
                    setShowForm(false)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              {fieldErrors.general && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {fieldErrors.general}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Cost Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Venue Deposit"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Amount *</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="CHF">CHF</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="0.00"
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                          fieldErrors.amount ? 'border-red-500' : 'border-gray-300'
                        }`}
                        required
                      />
                    </div>
                    {fieldErrors.amount && (
                      <p className="text-red-600 text-sm mt-1">{fieldErrors.amount}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Enter the cost amount</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                        fieldErrors.category ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    >
                      <option value="">Select category...</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    {fieldErrors.category && (
                      <p className="text-red-600 text-sm mt-1">{fieldErrors.category}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
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
                      onChange={(e) => {
                        // Prevent event from bubbling and preserve other form fields
                        e.stopPropagation()
                        setFormData(prev => ({ ...prev, payment_date: e.target.value }))
                      }}
                      onFocus={(e) => e.stopPropagation()}
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-1">Date when payment was/will be made</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Recurring Cost</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_recurring}
                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">This is a recurring cost</span>
                    </div>
                    {formData.is_recurring && (
                      <select
                        value={formData.recurring_frequency}
                        onChange={(e) => setFormData({ ...formData, recurring_frequency: e.target.value })}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      >
                        <option value="">Select frequency...</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Vendor Name</label>
                    <input
                      type="text"
                      value={formData.vendor_name}
                      onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Vendor Contact</label>
                    <input
                      type="text"
                      value={formData.vendor_contact}
                      onChange={(e) => setFormData({ ...formData, vendor_contact: e.target.value })}
                      placeholder="Email, phone, or address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Receipt URL
                    </label>
                    <input
                      type="url"
                      value={formData.receipt_url}
                      onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                      placeholder="URL to receipt image/PDF"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm()
                      setShowForm(false)
                    }}
                    className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createCost.isPending || updateCost.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {createCost.isPending || updateCost.isPending ? 'Saving...' : (editingId ? 'Update' : 'Create') + ' Cost'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Costs Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                      <td className="px-6 py-4">
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
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        >
                          <option value="planned">Planned</option>
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cost.vendor_name || cost.vendor || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {cost.receipt_url ? (
                          <a
                            href={cost.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(cost)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit cost"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this cost?')) {
                                deleteCost.mutate(cost.id)
                              }
                            }}
                            className="text-red-600 hover:text-red-800"
                            title="Delete cost"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
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
