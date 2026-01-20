import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import api from '../../lib/api'
import { Upload, Camera, X, CheckCircle } from 'lucide-react'

export default function PhotoGallery() {
  const { guest } = useGuestAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const externalFolderUrl = t('photo_gallery_folder_url')
  const externalUploadUrl = t('photo_gallery_upload_url')
  const hasExternalFolderUrl = externalFolderUrl && externalFolderUrl !== 'photo_gallery_folder_url'
  const hasExternalUploadUrl = externalUploadUrl && externalUploadUrl !== 'photo_gallery_upload_url'
  const useExternalOnly = hasExternalFolderUrl || hasExternalUploadUrl

  const { data: photos, isLoading } = useQuery({
    queryKey: ['guest-photos'],
    queryFn: () => api.get('/guest-photos').then((res) => res.data),
    enabled: !useExternalOnly,
  })

  const uploadMutation = useMutation({
    mutationFn: (formData) => api.post('/guest-photos', formData),
    onSuccess: () => {
      queryClient.invalidateQueries(['guest-photos'])
      setSelectedFile(null)
      setPreview(null)
      setCaption('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      alert('Photo uploaded! It will be visible after admin approval.')
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Failed to upload photo')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/guest-photos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['guest-photos'])
    },
  })

  const handleFileSelect = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB')
      return
    }
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
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

  const handleUpload = () => {
    if (!selectedFile) return
    
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('caption', caption)
    uploadMutation.mutate(formData)
  }

  if (!useExternalOnly && isLoading) {
    return <div className="text-center py-8">Loading gallery...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Photo Gallery</h2>

      {useExternalOnly && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-2">Shared photo folder</h3>
          <p className="text-sm text-gray-600 mb-4">
            Please use the shared folder to view and upload photos. (In-app upload is disabled.)
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {hasExternalFolderUrl && (
              <a
                href={externalFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black text-center"
              >
                Open folder
              </a>
            )}
            {hasExternalUploadUrl && (
              <a
                href={externalUploadUrl}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 text-center"
              >
                Upload to folder
              </a>
            )}
          </div>
        </div>
      )}

      {useExternalOnly && (
        <div className="text-sm text-gray-600">
          Tip: If you don’t want guests to see the in-app gallery at all, don’t upload photos here anymore—use the shared folder only.
        </div>
      )}

      {!useExternalOnly && (
        <>
          {/* Upload Section */}
          {guest && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold mb-4">Upload a Photo</h3>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="Preview" className="max-w-full max-h-64 mx-auto rounded-lg" />
                    <button
                      onClick={() => {
                        setSelectedFile(null)
                        setPreview(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="mt-4">
                      <input
                        type="text"
                        placeholder="Add a caption (optional)"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
                      />
                      <button
                        onClick={handleUpload}
                        disabled={uploadMutation.isPending}
                        className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50"
                      >
                        {uploadMutation.isPending ? 'Uploading...' : 'Upload Photo'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Camera className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-2">Drag and drop a photo here, or click to browse</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
                    >
                      Select Photo
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos && photos.length > 0 ? (
              photos.map((photo) => (
                <div key={photo.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="relative aspect-square">
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Guest photo'}
                      className="w-full h-full object-cover"
                    />
                    {guest && photo.guest_id === guest.id && (
                      <button
                        onClick={() => {
                          if (window.confirm('Delete this photo?')) {
                            deleteMutation.mutate(photo.id)
                          }
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {!photo.is_approved && (
                      <div className="absolute bottom-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs">
                        Pending Approval
                      </div>
                    )}
                  </div>
                  {photo.caption && (
                    <div className="p-4">
                      <p className="text-sm text-gray-600">{photo.caption}</p>
                      <p className="text-xs text-gray-400 mt-1">by {photo.guest_name}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p>No photos yet. Be the first to share!</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

