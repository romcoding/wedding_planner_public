import React, { useEffect, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Image as ImageIcon, Upload, X } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'

const ImagesPage = () => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    position: '',
  })

  const [externalViewUrl, setExternalViewUrl] = useState('')
  const [externalUploadUrl, setExternalUploadUrl] = useState('')

  const SETTINGS_KEYS = {
    view: 'photo_gallery_folder_url',
    upload: 'photo_gallery_upload_url',
  }

  const { data: contentItems } = useQuery({
    queryKey: ['content', 'admin'],
    queryFn: () => api.get('/content?lang=en').then((r) => r.data),
  })

  useEffect(() => {
    if (!contentItems) return
    const view = contentItems.find((c) => c.key === SETTINGS_KEYS.view)?.content || ''
    const upload = contentItems.find((c) => c.key === SETTINGS_KEYS.upload)?.content || ''
    setExternalViewUrl(view)
    setExternalUploadUrl(upload)
  }, [contentItems])

  const saveWebSettings = useMutation({
    mutationFn: async ({ key, value }) => {
      const existing = contentItems?.find((c) => c.key === key)
      if (existing?.id) {
        return api.put(`/content/${existing.id}`, {
          content_type: 'text',
          is_public: true,
          content_en: value,
        })
      }
      return api.post('/content', {
        key,
        title: key,
        content_type: 'text',
        is_public: true,
        content_en: value,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['content', 'admin'])
      queryClient.invalidateQueries(['content', 'public'])
      toast.success('Saved')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to save'),
  })

  const { data: images, isLoading } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  const createImage = useMutation({
    mutationFn: async (formDataToSend) => {
      // Upload file directly to backend
      // Don't set Content-Type header - axios will set it automatically with boundary
      return api.post('/images', formDataToSend)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['images'])
      resetForm()
      setShowForm(false)
    },
    onError: (error) => {
      console.error('Error creating image:', error)
      alert(error.response?.data?.error || 'Failed to upload image. Please try again.')
      setUploading(false)
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

  const handleFileSelect = (file) => {
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
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target.result)
    }
    reader.readAsDataURL(file)
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
    setUploading(false)
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
      // For editing, we only update position
      const image = images.find(img => img.id === editingId)
      updateImage.mutate({
        id: editingId,
        data: {
          ...image,
          position: formData.position,
        },
      })
    } else {
      // For new images, upload the file
      if (!selectedFile) {
        alert('Please select an image file')
        return
      }

      if (!formData.position) {
        alert('Please select a position for the image')
        return
      }

      setUploading(true)

      // Create FormData for file upload
      const formDataToSend = new FormData()
      formDataToSend.append('file', selectedFile)
      formDataToSend.append('position', formData.position)

      createImage.mutate(formDataToSend)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // Handle URL input (alternative method)
  const handleUrlSubmit = async (url) => {
    if (!url || !url.trim()) {
      alert('Please enter an image URL')
      return
    }

    if (!formData.position) {
      alert('Please select a position for the image')
      return
    }

    setUploading(true)

    try {
      const response = await api.post('/images', {
        name: `Image ${Date.now()}`,
        url: url.trim(),
        position: formData.position,
        category: 'gallery',
        is_active: true,
        is_public: true,
      })

      queryClient.invalidateQueries(['images'])
      resetForm()
      setShowForm(false)
    } catch (error) {
      console.error('Error creating image:', error)
      alert(error.response?.data?.error || 'Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) {
    return <div className="p-6">Loading images...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Web page</h1>
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

      {/* External photo folder settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Photo gallery storage</h2>
        <p className="text-sm text-gray-600 mb-4">
          You can link a Google Drive or OneDrive folder for guests. For a real in-app gallery sourced from Drive/OneDrive,
          we’d need OAuth + APIs; this v1 uses links (view + upload) so guests can open the folder and add photos there.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Folder view link</label>
            <input
              type="url"
              value={externalViewUrl}
              onChange={(e) => setExternalViewUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/... or https://1drv.ms/f/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload link (request-files)</label>
            <input
              type="url"
              value={externalUploadUrl}
              onChange={(e) => setExternalUploadUrl(e.target.value)}
              placeholder="OneDrive 'Request files' link or similar"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => saveWebSettings.mutate({ key: SETTINGS_KEYS.view, value: externalViewUrl || '' })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm font-medium"
            disabled={saveWebSettings.isPending}
          >
            Save folder link
          </button>
          <button
            type="button"
            onClick={() => saveWebSettings.mutate({ key: SETTINGS_KEYS.upload, value: externalUploadUrl || '' })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm font-medium"
            disabled={saveWebSettings.isPending}
          >
            Save upload link
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
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
                        Supported: JPG, PNG, GIF, WEBP (Max 10MB)
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Alternative: URL Input */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-2">Or paste image URL:</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleUrlSubmit(e.target.value)
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = e.target.previousElementSibling
                        handleUrlSubmit(input.value)
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Use URL
                    </button>
                  </div>
                </div>
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

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={uploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : editingId ? 'Update Position' : 'Upload Image'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
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
