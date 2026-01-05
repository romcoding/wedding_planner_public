import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Languages, Sparkles } from 'lucide-react'

const ContentPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [activeTab, setActiveTab] = useState('en') // Language tab
  const [autoTranslate, setAutoTranslate] = useState(false)
  const [sourceLanguage, setSourceLanguage] = useState('de') // Default source language
  const [formData, setFormData] = useState({
    key: '',
    title: '',
    content_en: '',
    content_de: '',
    content_fr: '',
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

  const translateContent = useMutation({
    mutationFn: async ({ text, sourceLang }) => {
      // Call translation endpoint (if implemented) or use frontend translation
      // For now, we'll handle it in the backend
      const response = await api.post('/content/translate', {
        text,
        source_language: sourceLang,
        target_languages: ['en', 'de', 'fr'].filter(l => l !== sourceLang)
      })
      return response.data
    },
  })

  const resetForm = () => {
    setFormData({
      key: '',
      title: '',
      content_en: '',
      content_de: '',
      content_fr: '',
      content_type: 'text',
      is_public: true,
      order: 0,
    })
    setEditingId(null)
    setActiveTab('en')
    setAutoTranslate(false)
  }

  const handleTranslate = async () => {
    const sourceText = formData[`content_${sourceLanguage}`]
    if (!sourceText) {
      alert('Please enter text in the source language first')
      return
    }

    try {
      // Auto-translate when submitting
      setAutoTranslate(true)
    } catch (error) {
      console.error('Translation error:', error)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...formData,
      order: parseInt(formData.order, 10),
      auto_translate: autoTranslate,
      source_language: sourceLanguage,
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
      content_type: item.content_type,
      is_public: item.is_public,
      order: item.order,
    })
    setShowForm(true)
  }

  const handleLanguageChange = (lang) => {
    setActiveTab(lang)
    setSourceLanguage(lang)
  }

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
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Key *</label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="e.g., rsvp_introduction, welcome_message"
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
          </div>

          {/* Translation Settings */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
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
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="de">German (Deutsch)</option>
                  <option value="en">English</option>
                  <option value="fr">French (Français)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_translate"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="auto_translate" className="text-sm text-gray-700 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Auto-translate to other languages
                </label>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Enter text in your source language. If auto-translate is enabled, other languages will be automatically translated (you can still edit them).
            </p>
          </div>

          {/* Language Tabs */}
          <div className="mb-4">
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
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {lang.flag} {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Editor for Active Language */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Content ({activeTab === 'en' ? 'English' : activeTab === 'de' ? 'Deutsch' : 'Français'}) *
            </label>
            <textarea
              value={formData[`content_${activeTab}`]}
              onChange={(e) => setFormData({ ...formData, [`content_${activeTab}`]: e.target.value })}
              rows="8"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              required
              placeholder={`Enter content in ${activeTab === 'en' ? 'English' : activeTab === 'de' ? 'German' : 'French'}...`}
            />
          </div>

          {/* Show other languages for editing */}
          {activeTab !== 'en' && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium mb-1 text-gray-700">English</label>
              <textarea
                value={formData.content_en}
                onChange={(e) => setFormData({ ...formData, content_en: e.target.value })}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="English translation..."
              />
            </div>
          )}
          {activeTab !== 'de' && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium mb-1 text-gray-700">Deutsch</label>
              <textarea
                value={formData.content_de}
                onChange={(e) => setFormData({ ...formData, content_de: e.target.value })}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Deutsche Übersetzung..."
              />
            </div>
          )}
          {activeTab !== 'fr' && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium mb-1 text-gray-700">Français</label>
              <textarea
                value={formData.content_fr}
                onChange={(e) => setFormData({ ...formData, content_fr: e.target.value })}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Traduction française..."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
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
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Languages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contents?.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
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
    </div>
  )
}

export default ContentPage
