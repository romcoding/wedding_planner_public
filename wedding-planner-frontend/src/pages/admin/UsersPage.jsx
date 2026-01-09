import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { Users, Plus, Edit, Trash2, Shield, CheckCircle, XCircle } from 'lucide-react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Tooltip from '../../components/ui/Tooltip'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorMessage from '../../components/ui/ErrorMessage'

const UsersPage = () => {
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    is_active: true
  })

  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(res => res.data),
  })

  const { data: currentUser } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => api.get('/auth/profile').then(res => res.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users'])
      setShowModal(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users'])
      setShowModal(false)
      setEditingUser(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['users'])
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      is_active: true
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active
    })
    setShowModal(true)
  }

  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const handleDelete = (user) => {
    setDeleteConfirm(user)
  }

  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
  const canDeleteUsers = currentUser?.role === 'super_admin'

  const roleColors = {
    guest: 'bg-gray-100 text-gray-800',
    vendor: 'bg-blue-100 text-blue-800',
    planner: 'bg-purple-100 text-purple-800',
    admin: 'bg-green-100 text-green-800',
    super_admin: 'bg-red-100 text-red-800',
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <LoadingSpinner size="lg" className="mx-auto" />
        <p className="mt-4 text-gray-600">Loading users...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage users and their roles</p>
        </div>
        {(createMutation.isError || updateMutation.isError || deleteMutation.isError) && (
          <ErrorMessage
            message={createMutation.error?.response?.data?.error || updateMutation.error?.response?.data?.error || deleteMutation.error?.response?.data?.error || 'An error occurred'}
            onDismiss={() => {
              createMutation.reset()
              updateMutation.reset()
              deleteMutation.reset()
            }}
          />
        )}
        {canManageUsers && (
          <button
            onClick={() => {
              setEditingUser(null)
              resetForm()
              setShowModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add User
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users?.map((user) => (
              <tr key={user.id} className={!user.is_active ? 'opacity-60' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColors[user.role] || 'bg-gray-100 text-gray-800'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.is_active ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="w-4 h-4" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {canManageUsers && (
                    <div className="flex justify-end gap-2">
                      <Tooltip content="Edit user">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      </Tooltip>
                      {canDeleteUsers && user.id !== currentUser?.id && (
                        <Tooltip content="Delete user">
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingUser ? 'Edit User' : 'Add User'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                >
                  <option value="guest">Guest</option>
                  <option value="vendor">Vendor</option>
                  <option value="planner">Planner</option>
                  <option value="admin">Admin</option>
                  {currentUser?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                </select>
              </div>
              {canManageUsers && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingUser(null)
                    resetForm()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            deleteMutation.mutate(deleteConfirm.id)
            setDeleteConfirm(null)
          }
        }}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteConfirm?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}

export default UsersPage
