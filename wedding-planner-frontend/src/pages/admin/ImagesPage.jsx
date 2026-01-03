import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Image as ImageIcon, Upload, X } from 'lucide-react'

const ImagesPage = () => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [formData, setFormData] = useState({
    position: '',
  })

  const { data: images, isLoading } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  const createImage = useMutation({
    mutationFn: async (payload) => {
      // If we have a file, we need to upload it first
      // For now, we'll convert to base64 and use data URL, or guide user to upload to Imgur
      if (selectedFile) {
        // Convert file to base64 for preview/storage
        const base64 = await fileToBase64(selectedFile)
        // For production, you'd upload to a service like Imgur API
        // For now, we'll use the base64 data URL (not ideal for large images)
        // Or we can guide the user to upload manually
        payload.url = base64
        payload.name = selectedFile.name
      }
      return api.post('/images', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['images'])
      resetForm()
      setShowForm(false)
    },
    onError: (error) => {
      console.error('Error creating image:', error)
      alert(error.response?.data?.error || 'Failed to create image. Please upload to Imgur first and paste the URL.')
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

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (error) => reject(error)
    })
  }

  const handleFileSelect = async (file) => {
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB')
      return
    }

    setSelectedFile(file)
    
    // Create preview
    const base64 = await fileToBase64(file)
    setImagePreview(base64)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    handleFileSelect(file)
  }

  const resetForm = () => {
    setFormData({
      position: '',
    })
    setSelectedFile(null)
    setImagePreview(null)
    setEditingId(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleEdit = (image) => {
    setFormData({
      position: image.position || '',
    })
    setSelectedFile(null)
    setImagePreview(image.url)
    setEditingId(image.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (editingId) {
      // For editing, we need to keep existing image data
      const image = images.find(img => img.id === editingId)
      updateImage.mutate({
        id: editingId,
        data: {
          ...image,
          position: formData.position,
        },
      })
    } else {
      // For new images, we need a URL
      if (!selectedFile && !imagePreview) {
        alert('Please select an image file')
        return
      }

      if (!formData.position) {
        alert('Please select a position for the image')
        return
      }

      // If user selected a file, use it
      // Otherwise, if they have a preview URL, use that
      const payload = {
        name: selectedFile ? selectedFile.name : `Image ${Date.now()}`,
        url: imagePreview || '',
        position: formData.position,
        category: 'gallery',
        is_active: true,
        is_public: true,
      }

      // If using base64, warn user it's better to upload to Imgur
      if (imagePreview && imagePreview.startsWith('data:')) {
        const useBase64 = window.confirm(
          'Using base64 images can be slow. For better performance, upload to Imgur (imgur.com) and paste the direct image URL instead. Continue with base64?'
        )
        if (!useBase64) {
          // Show instructions
          alert('1. Go to imgur.com\n2. Upload your image\n3. Right-click the image → Copy image address\n4. Paste the URL in the form')
          return
        }
      }

      createImage.mutate(payload)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
            {editingId ? 'Edit Image Position' : 'Add New Image'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Upload Area */}
            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Image *
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null)
                          setImagePreview(null)
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {selectedFile && (
                        <p className="mt-2 text-sm text-gray-600">
                          {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">
                        Drag and drop an image here, or click to browse
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Select File
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Supported: JPG, PNG, GIF (Max 10MB)
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Tip: For better performance, upload to{' '}
                  <a
                    href="https://imgur.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Imgur
                  </a>{' '}
                  and paste the direct image URL instead
                </p>
              </div>
            )}

            {/* Position Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position *
              </label>
              <select
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select position...</option>
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

            {/* Alternative: Direct URL Input (for Imgur URLs) */}
            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Or paste image URL (from Imgur, etc.)
                </label>
                <input
                  type="url"
                  placeholder="https://i.imgur.com/example.jpg"
                  onChange={(e) => {
                    if (e.target.value) {
                      setImagePreview(e.target.value)
                      setSelectedFile(null)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {editingId ? 'Update Position' : 'Add Image'}
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
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{image.name}</h3>
                {image.position && (
                  <p className="text-sm text-blue-600 mb-2">
                    Position: {image.position}
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
