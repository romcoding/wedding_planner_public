import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit } from 'lucide-react'

const ContentPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    key: '',
    title: '',
    content: '',
    content_type: 'text',
    is_public: true,
    order: 0,
  })

  const { data: contents, isLoading } = useQuery({
    queryKey: ['content', 'admin'],
    queryFn: () => api.get('/content?admin=true').then((res) => res.data),
  })

  const createContent = useMutation({
    mutationFn: (payload) => api.post('/content', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['content'])
      resetForm()
      setShowForm(false)
    },
  })

  const updateContent = useMutation({
    mutationFn: ({ id, data }) => api.put(`/content/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['content'])
      resetForm()
      setShowForm(false)
    },
  })

  const deleteContent = useMutation({
    mutationFn: (id) => api.delete(`/content/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['content']),
  })

  const resetForm = () => {
    setFormData({
      key: '',
      title: '',
      content: '',
      content_type: 'text',
      is_public: true,
      order: 0,
    })
    setEditingId(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...formData, order: parseInt(formData.order, 10) }
    if (editingId) {
      updateContent.mutate({ id: editingId, data: payload })
    } else {
      createContent.mutate(payload)
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setFormData({
      key: item.key,
      title: item.title ?? '',
      content: item.content ?? '',
      content_type: item.content_type,
      is_public: item.is_public,
      order: item.order,
    })
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Management</h1>
          <p className="text-gray-600 mt-1">Manage content displayed to guests</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm((prev) => !prev)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="h-5 w-5" />
          <span>{editingId ? 'Edit Content' : 'Add Content'}</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Key *</label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="e.g., welcome_message, venue_info"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!!editingId}
              />
              <p className="text-xs text-gray-500 mt-1">Unique identifier (cannot be changed)</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Order</label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-700">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-700">Content *</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows="6"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Content Type</label>
              <select
                value={formData.content_type}
                onChange={(e) =>
                  setFormData({ ...formData, content_type: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="text">Text</option>
                <option value="html">HTML</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Visibility</label>
              <select
                value={formData.is_public ? 'public' : 'private'}
                onChange={(e) =>
                  setFormData({ ...formData, is_public: e.target.value === 'public' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="public">Public (Visible to guests)</option>
                <option value="private">Private (Admin only)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading content...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contents?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No content yet. Add your first content item!
                    </td>
                  </tr>
                ) : (
                  contents?.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.key}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{item.title || '-'}</div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.content}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.order}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.content_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          item.is_public 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.is_public ? 'Public' : 'Private'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => deleteContent.mutate(item.id)}
                            className="text-red-600 hover:text-red-800"
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

export default ContentPage
