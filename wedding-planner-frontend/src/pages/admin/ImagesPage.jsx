import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Image as ImageIcon, Eye, EyeOff } from 'lucide-react'

const ImagesPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    alt_text: '',
    description: '',
    category: 'gallery',
    position: '',
    order: 0,
    is_active: true,
    is_public: true,
  })

  const { data: images, isLoading } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  const createImage = useMutation({
    mutationFn: (payload) => api.post('/images', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['images'])
      resetForm()
      setShowForm(false)
    },
  })

  const updateImage = useMutation({
    mutationFn: ({ id, data }) => api.put(`/images/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['images'])
      resetForm()
      setShowForm(false)
    },
  })

  const deleteImage = useMutation({
    mutationFn: (id) => api.delete(`/images/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['images']),
  })

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      alt_text: '',
      description: '',
      category: 'gallery',
      position: '',
      order: 0,
      is_active: true,
      is_public: true,
    })
    setEditingId(null)
  }

  const handleEdit = (image) => {
    setFormData({
      name: image.name,
      url: image.url,
      alt_text: image.alt_text || '',
      description: image.description || '',
      category: image.category || 'gallery',
      position: image.position || '',
      order: image.order || 0,
      is_active: image.is_active,
      is_public: image.is_public,
    })
    setEditingId(image.id)
    setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingId) {
      updateImage.mutate({ id: editingId, data: formData })
    } else {
      createImage.mutate(formData)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  if (isLoading) {
    return <div className="p-6">Loading images...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Image Management</h1>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <PlusCircle className="w-5 h-5" />
          Add Image
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Edit Image' : 'Add New Image'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL *
              </label>
              <input
                type="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                required
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload to Imgur, Google Photos, or Dropbox and paste the direct image URL here
              </p>
            </div>

            {formData.url && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm text-gray-600 mb-2">Preview:</p>
                <img
                  src={formData.url}
                  alt="Preview"
                  className="max-w-full h-48 object-cover rounded"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'block'
                  }}
                />
                <p className="text-sm text-red-500 hidden">Failed to load image</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alt Text
              </label>
              <input
                type="text"
                name="alt_text"
                value={formData.alt_text}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gallery">Gallery</option>
                  <option value="hero">Hero</option>
                  <option value="info_section">Info Section</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  <option value="hero">Hero (Main Couple Photo)</option>
                  <option value="photo1">Photo 1 (RSVP Left)</option>
                  <option value="photo2">Photo 2 (RSVP Left)</option>
                  <option value="photo3">Photo 3 (RSVP Left)</option>
                  <option value="info_top">Info Page Top</option>
                  <option value="edit_rsvp">Edit RSVP</option>
                  <option value="travel">Travel & Accommodation</option>
                  <option value="gifts">Event & Gifts</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order (for sorting)
              </label>
              <input
                type="number"
                name="order"
                value={formData.order}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Public (visible to guests)</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {editingId ? 'Update' : 'Create'}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {images && images.length > 0 ? (
          images.map((image) => (
            <div
              key={image.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="relative h-48 bg-gray-200">
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.alt_text || image.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  {image.is_public ? (
                    <Eye className="w-5 h-5 text-green-500" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  )}
                  {!image.is_active && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{image.name}</h3>
                {image.position && (
                  <p className="text-sm text-blue-600 mb-1">
                    Position: {image.position}
                  </p>
                )}
                {image.category && (
                  <p className="text-sm text-gray-600 mb-2">
                    Category: {image.category}
                  </p>
                )}
                {image.description && (
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                    {image.description}
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(image)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this image?')) {
                        deleteImage.mutate(image.id)
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700"
                  >
                    <Trash className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            No images yet. Click "Add Image" to get started.
          </div>
        )}
      </div>
    </div>
  )
}

export default ImagesPage

