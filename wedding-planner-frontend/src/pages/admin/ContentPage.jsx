import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Languages, Sparkles, Calendar, X, Eye } from 'lucide-react'

const ContentPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [previewContent, setPreviewContent] = useState(null)
  const [activeTab, setActiveTab] = useState('en')
  const [autoTranslate, setAutoTranslate] = useState(false)
  const [sourceLanguage, setSourceLanguage] = useState('en')
  const [formData, setFormData] = useState({
    key: '',
    title: '',
    content_en: '',
    content_de: '',
    content_fr: '',
    content_type: 'html',
    is_public: true,
    order: 0,
    scheduled_publish_at: '',
    scheduled_unpublish_at: '',
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
      alert('Content created successfully!')
    },
    onError: (error) => {
      console.error('Error creating content:', error)
      alert(error.response?.data?.error || 'Failed to create content. Please check all required fields.')
    },
  })

  const updateContent = useMutation({
    mutationFn: ({ id, data }) => api.put(`/content/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['content'])
      resetForm()
      setShowForm(false)
      alert('Content updated successfully!')
    },
    onError: (error) => {
      console.error('Error updating content:', error)
      alert(error.response?.data?.error || 'Failed to update content. Please check all required fields.')
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
      content_en: '',
      content_de: '',
      content_fr: '',
      content_type: 'html',
      is_public: true,
      order: 0,
      scheduled_publish_at: '',
      scheduled_unpublish_at: '',
    })
    setEditingId(null)
    setActiveTab('en')
    setAutoTranslate(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...formData,
      order: parseInt(formData.order, 10),
      auto_translate: autoTranslate,
      source_language: sourceLanguage,
      scheduled_publish_at: formData.scheduled_publish_at || null,
      scheduled_unpublish_at: formData.scheduled_unpublish_at || null,
    }
    
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
      content_en: item.content_en || item.content || '',
      content_de: item.content_de || '',
      content_fr: item.content_fr || '',
      content_type: item.content_type || 'html',
      is_public: item.is_public,
      order: item.order,
      scheduled_publish_at: item.scheduled_publish_at ? new Date(item.scheduled_publish_at).toISOString().slice(0, 16) : '',
      scheduled_unpublish_at: item.scheduled_unpublish_at ? new Date(item.scheduled_unpublish_at).toISOString().slice(0, 16) : '',
    })
    setShowForm(true)
  }

  const handleLanguageChange = (lang) => {
    setActiveTab(lang)
    setSourceLanguage(lang)
  }

  const handleContentChange = (value) => {
    setFormData({ ...formData, [`content_${activeTab}`]: value })
  }

  // Quill modules configuration
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'image'],
      ['clean']
    ],
  }), [])

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Management</h1>
          <p className="text-gray-600 mt-1">Manage all text content displayed to guests (multilingual)</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="h-5 w-5" />
          <span>Add Content</span>
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              resetForm()
              setShowForm(false)
            }
          }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto z-[10000]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                  {editingId ? 'Edit Content' : 'Create New Content'}
                </h2>
                <button
                  onClick={() => {
                    resetForm()
                    setShowForm(false)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Key *</label>
                    <input
                      type="text"
                      value={formData.key}
                      onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                      placeholder="e.g., rsvp_introduction, welcome_message"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                {/* Translation Settings */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Languages className="w-5 h-5 text-blue-600" />
                      <label className="text-sm font-medium text-gray-700">Source Language:</label>
                      <select
                        value={sourceLanguage}
                        onChange={(e) => {
                          setSourceLanguage(e.target.value)
                          setActiveTab(e.target.value)
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      >
                        <option value="en">English</option>
                        <option value="de">German (Deutsch)</option>
                        <option value="fr">French (Français)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="auto_translate"
                        checked={autoTranslate}
                        onChange={(e) => setAutoTranslate(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="auto_translate" className="text-sm text-gray-700 flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        Auto-translate to other languages
                      </label>
                    </div>
                  </div>
                </div>

                {/* Language Tabs */}
                <div>
                  <div className="flex border-b border-gray-200">
                    {[
                      { code: 'en', label: 'English', flag: '🇬🇧' },
                      { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
                      { code: 'fr', label: 'Français', flag: '🇫🇷' },
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                          activeTab === lang.code
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-700 hover:text-gray-900'
                        }`}
                      >
                        {lang.flag} {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* WYSIWYG Editor for Active Language */}
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    Content ({activeTab === 'en' ? 'English' : activeTab === 'de' ? 'Deutsch' : 'Français'}) *
                  </label>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <ReactQuill
                      theme="snow"
                      value={formData[`content_${activeTab}`]}
                      onChange={handleContentChange}
                      modules={quillModules}
                      style={{ minHeight: '300px' }}
                    />
                  </div>
                </div>

                {/* Show other languages for editing */}
                {activeTab !== 'en' && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium mb-1 text-gray-700">English</label>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <ReactQuill
                        theme="snow"
                        value={formData.content_en}
                        onChange={(value) => setFormData({ ...formData, content_en: value })}
                        modules={quillModules}
                        style={{ minHeight: '200px' }}
                      />
                    </div>
                  </div>
                )}
                {activeTab !== 'de' && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Deutsch</label>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <ReactQuill
                        theme="snow"
                        value={formData.content_de}
                        onChange={(value) => setFormData({ ...formData, content_de: value })}
                        modules={quillModules}
                        style={{ minHeight: '200px' }}
                      />
                    </div>
                  </div>
                )}
                {activeTab !== 'fr' && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Français</label>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <ReactQuill
                        theme="snow"
                        value={formData.content_fr}
                        onChange={(value) => setFormData({ ...formData, content_fr: value })}
                        modules={quillModules}
                        style={{ minHeight: '200px' }}
                      />
                    </div>
                  </div>
                )}

                {/* Scheduling */}
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-700">Scheduling</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700">Schedule Publish</label>
                      <input
                        type="datetime-local"
                        value={formData.scheduled_publish_at}
                        onChange={(e) => setFormData({ ...formData, scheduled_publish_at: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Content will be published at this time</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700">Schedule Unpublish</label>
                      <input
                        type="datetime-local"
                        value={formData.scheduled_unpublish_at}
                        onChange={(e) => setFormData({ ...formData, scheduled_unpublish_at: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Content will be unpublished at this time</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Content Type</label>
                    <select
                      value={formData.content_type}
                      onChange={(e) => setFormData({ ...formData, content_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
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
                      onChange={(e) => setFormData({ ...formData, is_public: e.target.value === 'public' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    >
                      <option value="public">Public (Visible to guests)</option>
                      <option value="private">Private (Admin only)</option>
                    </select>
                  </div>
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
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {editingId ? 'Update' : 'Create'} Content
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Content List */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Languages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visibility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contents?.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1">
                          {item.content_en && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">EN</span>}
                          {item.content_de && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">DE</span>}
                          {item.content_fr && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">FR</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.scheduled_publish_at ? (
                          <div>
                            <div className="text-xs">Publish: {new Date(item.scheduled_publish_at).toLocaleString()}</div>
                            {item.scheduled_unpublish_at && (
                              <div className="text-xs">Unpublish: {new Date(item.scheduled_unpublish_at).toLocaleString()}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
                            onClick={() => setPreviewContent(item)}
                            className="text-green-600 hover:text-green-800 flex items-center gap-1"
                            title="Preview content"
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this content?')) {
                                deleteContent.mutate(item.id)
                              }
                            }}
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

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Content Preview: {previewContent.title || previewContent.key}</h2>
                <button
                  onClick={() => setPreviewContent(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Key: {previewContent.key}</h3>
                  <p className="text-sm text-gray-600">Type: {previewContent.content_type}</p>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">English (EN)</h3>
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewContent.content_en || previewContent.content || '<p class="text-gray-400">No content</p>' }}
                  />
                </div>
                
                {previewContent.content_de && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">German (DE)</h3>
                    <div 
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewContent.content_de }}
                    />
                  </div>
                )}
                
                {previewContent.content_fr && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">French (FR)</h3>
                    <div 
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewContent.content_fr }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContentPage
