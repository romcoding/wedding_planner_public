import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Mail, X, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const InvitationsPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    guest_name: '',
    plus_one_allowed: false,
    plus_one_count: 0,
    expires_days: 30,
    send_email: true,
  })

  const { data: invitations, isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api.get('/invitations').then((res) => res.data),
  })

  const createInvitation = useMutation({
    mutationFn: (payload) => api.post('/invitations', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['invitations'])
      resetForm()
      setShowForm(false)
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Failed to create invitation')
    },
  })

  const resendInvitation = useMutation({
    mutationFn: (id) => api.post(`/invitations/${id}/resend`),
    onSuccess: () => {
      queryClient.invalidateQueries(['invitations'])
      alert('Invitation resent successfully!')
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Failed to resend invitation')
    },
  })

  const revokeInvitation = useMutation({
    mutationFn: (id) => api.post(`/invitations/${id}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries(['invitations'])
      alert('Invitation revoked successfully')
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Failed to revoke invitation')
    },
  })

  const resetForm = () => {
    setFormData({
      email: '',
      guest_name: '',
      plus_one_allowed: false,
      plus_one_count: 0,
      expires_days: 30,
      send_email: true,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    createInvitation.mutate(formData)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'sent':
        return <Mail className="w-5 h-5 text-blue-500" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'revoked':
      case 'expired':
        return <X className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'revoked':
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return <div className="p-6">Loading invitations...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invitation Management</h1>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <PlusCircle className="w-5 h-5" />
          Send Invitation
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New Invitation</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guest Name (Optional)
              </label>
              <input
                type="text"
                name="guest_name"
                value={formData.guest_name}
                onChange={handleChange}
                placeholder="e.g., John & Jane"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="plus_one_allowed"
                  checked={formData.plus_one_allowed}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Allow Plus-One</span>
              </label>
            </div>

            {formData.plus_one_allowed && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Plus-Ones
                </label>
                <input
                  type="number"
                  name="plus_one_count"
                  value={formData.plus_one_count}
                  onChange={handleChange}
                  min="0"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expires In (Days)
              </label>
              <input
                type="number"
                name="expires_days"
                value={formData.expires_days}
                onChange={handleChange}
                min="1"
                max="365"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="send_email"
                  checked={formData.send_email}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Send invitation email immediately</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Invitation
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plus-One</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invitations && invitations.length > 0 ? (
                invitations.map((invitation) => (
                  <tr key={invitation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invitation.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invitation.guest_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invitation.status)}`}>
                        {getStatusIcon(invitation.status)}
                        {invitation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invitation.plus_one_allowed ? `Yes (${invitation.plus_one_count})` : 'No'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invitation.sent_at ? new Date(invitation.sent_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invitation.expires_at ? new Date(invitation.expires_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {invitation.status !== 'accepted' && invitation.status !== 'revoked' && (
                          <>
                            <button
                              onClick={() => resendInvitation.mutate(invitation.id)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Resend"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Are you sure you want to revoke this invitation?')) {
                                  revokeInvitation.mutate(invitation.id)
                                }
                              }}
                              className="text-red-600 hover:text-red-800"
                              title="Revoke"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No invitations yet. Click "Send Invitation" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default InvitationsPage

