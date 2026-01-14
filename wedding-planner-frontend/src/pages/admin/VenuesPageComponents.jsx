// Venue Tab Components - Extracted for better organization
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { 
  PlusCircle, 
  Trash, 
  Edit, 
  X, 
  Loader, 
  Upload, 
  FileText, 
  MessageSquare,
  HelpCircle,
  Check,
  AlertCircle,
  Download,
  Eye,
  DollarSign
} from 'lucide-react'

// Venue Offers Tab Component with inline editing
export function VenueOffersTab({ venueId }) {
  const queryClient = useQueryClient()
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [showCostForm, setShowCostForm] = useState(false)
  const [costFormOffer, setCostFormOffer] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingOffer, setEditingOffer] = useState(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [inlineEditData, setInlineEditData] = useState({})
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '', order: 0 })
  const [offerFormData, setOfferFormData] = useState({
    name: '',
    description: '',
    price: '',
    price_type: 'fixed',
    currency: 'EUR',
    unit: '',
    order: 0,
    min_quantity: '',
    max_quantity: '',
    is_available: true,
    notes: ''
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [costFormData, setCostFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'EUR',
    category: 'Venue',
    status: 'planned',
    vendor_name: '',
    vendor_contact: '',
    notes: ''
  })

  const { data: categories, isLoading } = useQuery({
    queryKey: ['venue-offers', venueId],
    queryFn: () => api.get(`/venues/${venueId}/categories`).then(res => res.data),
    enabled: !!venueId, // Only run query if venueId is defined
  })

  const createCategory = useMutation({
    mutationFn: (data) => api.post(`/venues/${venueId}/categories`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue-offers', venueId])
      setShowCategoryForm(false)
      setCategoryFormData({ name: '', description: '', order: 0 })
      setFieldErrors({})
    },
    onError: (error) => {
      const errorData = error.response?.data
      setFieldErrors({ general: errorData?.error || 'Failed to create category' })
    },
  })

  const updateCategory = useMutation({
    mutationFn: ({ id, data }) => api.put(`/venues/${venueId}/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue-offers', venueId])
      setEditingCategory(null)
      setCategoryFormData({ name: '', description: '', order: 0 })
      setFieldErrors({})
    },
    onError: (error) => {
      const errorData = error.response?.data
      setFieldErrors({ general: errorData?.error || 'Failed to update category' })
    },
  })

  const deleteCategory = useMutation({
    mutationFn: (id) => api.delete(`/venues/${venueId}/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue-offers', venueId])
    },
  })

  const createOffer = useMutation({
    mutationFn: (data) => api.post(`/venues/${venueId}/categories/${selectedCategoryId}/offers`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue-offers', venueId])
      setShowOfferForm(false)
      setOfferFormData({
        name: '', description: '', price: '', price_type: 'fixed', currency: 'EUR',
        unit: '', order: 0, min_quantity: '', max_quantity: '', is_available: true, notes: ''
      })
      setSelectedCategoryId(null)
      setFieldErrors({})
    },
    onError: (error) => {
      const errorData = error.response?.data
      if (errorData?.errors) {
        setFieldErrors(errorData.errors)
      } else {
        setFieldErrors({ general: errorData?.error || 'Failed to create offer' })
      }
    },
  })

  const updateOffer = useMutation({
    mutationFn: ({ id, data }) => api.put(`/venues/${venueId}/offers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue-offers', venueId])
      setEditingOffer(null)
      setEditingOfferId(null)
      setInlineEditData({})
      setOfferFormData({
        name: '', description: '', price: '', price_type: 'fixed', currency: 'EUR',
        unit: '', order: 0, min_quantity: '', max_quantity: '', is_available: true, notes: ''
      })
      setFieldErrors({})
    },
    onError: (error) => {
      const errorData = error.response?.data
      if (errorData?.errors) {
        setFieldErrors(errorData.errors)
      } else {
        setFieldErrors({ general: errorData?.error || 'Failed to update offer' })
      }
    },
  })

  const deleteOffer = useMutation({
    mutationFn: (id) => api.delete(`/venues/${venueId}/offers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue-offers', venueId])
    },
  })

  const createCost = useMutation({
    mutationFn: (payload) => api.post('/costs', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['costs'])
      queryClient.invalidateQueries(['cost-analytics'])
      setShowCostForm(false)
      setCostFormOffer(null)
      setCostFormData({
        name: '',
        description: '',
        amount: '',
        currency: 'EUR',
        category: 'Venue',
        status: 'planned',
        vendor_name: '',
        vendor_contact: '',
        notes: ''
      })
      alert('Cost added successfully! You can view it in the Costs & Budget section.')
    },
    onError: (error) => {
      console.error('Error creating cost:', error)
      const errorData = error.response?.data
      alert(errorData?.error || 'Failed to create cost. Please try again.')
    },
  })

  const handleAddToCosts = (offer, category) => {
    setCostFormOffer(offer)
    setCostFormData({
      name: offer.name || '',
      description: offer.description || '',
      amount: offer.price ? parseFloat(offer.price).toString() : '',
      currency: offer.currency || 'EUR',
      category: 'Venue',
      status: 'planned',
      vendor_name: '',
      vendor_contact: '',
      notes: `From venue offer: ${category.name || 'Venue Offer'}`
    })
    setShowCostForm(true)
  }

  const handleCostSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...costFormData,
      amount: parseFloat(costFormData.amount) || 0,
    }
    createCost.mutate(payload)
  }

  const handleInlineEdit = (offer, field, value) => {
    setEditingOfferId(offer.id)
    setInlineEditData({ ...inlineEditData, [field]: value })
  }

  const handleInlineSave = (offer) => {
    const updates = {
      ...offer,
      ...inlineEditData,
      price: inlineEditData.price !== undefined ? parseFloat(inlineEditData.price) : offer.price,
      min_quantity: inlineEditData.min_quantity !== undefined ? (inlineEditData.min_quantity ? parseInt(inlineEditData.min_quantity) : null) : offer.min_quantity,
      max_quantity: inlineEditData.max_quantity !== undefined ? (inlineEditData.max_quantity ? parseInt(inlineEditData.max_quantity) : null) : offer.max_quantity,
    }
    updateOffer.mutate({ id: offer.id, data: updates })
  }

  const validateOffer = (data) => {
    const errors = {}
    if (data.price && (isNaN(parseFloat(data.price)) || parseFloat(data.price) < 0)) {
      errors.price = 'Price must be a positive number'
    }
    if (data.min_quantity && (isNaN(parseInt(data.min_quantity)) || parseInt(data.min_quantity) < 0)) {
      errors.min_quantity = 'Minimum quantity must be a positive integer'
    }
    if (data.max_quantity && (isNaN(parseInt(data.max_quantity)) || parseInt(data.max_quantity) < 0)) {
      errors.max_quantity = 'Maximum quantity must be a positive integer'
    }
    if (data.min_quantity && data.max_quantity && parseInt(data.min_quantity) > parseInt(data.max_quantity)) {
      errors.max_quantity = 'Maximum must be greater than minimum'
    }
    return errors
  }

  if (isLoading) return <div className="p-4">Loading offers...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Offer Categories</h3>
          <p className="text-sm text-gray-600">Organize venue offers into categories for easy comparison</p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null)
            setCategoryFormData({ name: '', description: '', order: 0 })
            setFieldErrors({})
            setShowCategoryForm(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
        >
          <PlusCircle className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {categories && categories.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No offer categories yet</p>
          <p className="text-sm text-gray-500 mb-4">Add your first category to start organizing venue offers</p>
          <button
            onClick={() => {
              setEditingCategory(null)
              setCategoryFormData({ name: '', description: '', order: 0 })
              setShowCategoryForm(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Create First Category
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {categories?.map((category) => (
            <div key={category.id} className="border-2 border-gray-200 rounded-lg p-5 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-lg text-gray-900">{category.name}</h4>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium">
                      {category.offers?.length || 0} offers
                    </span>
                  </div>
                  {category.description && (
                    <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(category)
                      setCategoryFormData({
                        name: category.name,
                        description: category.description || '',
                        order: category.order || 0
                      })
                      setFieldErrors({})
                      setShowCategoryForm(true)
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit category"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete category "${category.name}" and all its offers?`)) {
                        deleteCategory.mutate(category.id)
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete category"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Offers Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {category.offers && category.offers.length > 0 ? (
                      category.offers.map((offer) => (
                        <tr key={offer.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            {editingOfferId === offer.id ? (
                              <input
                                type="text"
                                value={inlineEditData.name !== undefined ? inlineEditData.name : offer.name}
                                onChange={(e) => handleInlineEdit(offer, 'name', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                onBlur={() => handleInlineSave(offer)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineSave(offer)
                                  if (e.key === 'Escape') {
                                    setEditingOfferId(null)
                                    setInlineEditData({})
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <div>
                                <div className="font-medium text-gray-900">{offer.name}</div>
                                {offer.description && (
                                  <div className="text-xs text-gray-500 mt-1">{offer.description}</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editingOfferId === offer.id ? (
                              <div className="flex gap-1">
                                <select
                                  value={inlineEditData.price_type !== undefined ? inlineEditData.price_type : offer.price_type}
                                  onChange={(e) => handleInlineEdit(offer, 'price_type', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                >
                                  <option value="fixed">Fixed</option>
                                  <option value="minimum_spend">Min. Spend</option>
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={inlineEditData.price !== undefined ? inlineEditData.price : (offer.price || '')}
                                  onChange={(e) => handleInlineEdit(offer, 'price', e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                  onBlur={() => handleInlineSave(offer)}
                                />
                                <select
                                  value={inlineEditData.currency !== undefined ? inlineEditData.currency : offer.currency}
                                  onChange={(e) => handleInlineEdit(offer, 'currency', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                >
                                  <option value="EUR">EUR</option>
                                  <option value="USD">USD</option>
                                  <option value="GBP">GBP</option>
                                  <option value="CHF">CHF</option>
                                </select>
                              </div>
                            ) : (
                              <div className="text-sm">
                                {offer.price ? (
                                  <span className="font-semibold text-gray-900">
                                    {offer.currency} {parseFloat(offer.price).toFixed(2)}
                                    {offer.price_type === 'minimum_spend' && (
                                      <span className="text-xs text-gray-500 ml-1">(min.)</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editingOfferId === offer.id ? (
                              <input
                                type="text"
                                value={inlineEditData.unit !== undefined ? inlineEditData.unit : (offer.unit || '')}
                                onChange={(e) => handleInlineEdit(offer, 'unit', e.target.value)}
                                placeholder="per person"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                onBlur={() => handleInlineSave(offer)}
                              />
                            ) : (
                              <span className="text-sm text-gray-600">{offer.unit || '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editingOfferId === offer.id ? (
                              <div className="flex gap-1 text-xs">
                                <input
                                  type="number"
                                  min="0"
                                  value={inlineEditData.min_quantity !== undefined ? inlineEditData.min_quantity : (offer.min_quantity || '')}
                                  onChange={(e) => handleInlineEdit(offer, 'min_quantity', e.target.value)}
                                  placeholder="Min"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                  onBlur={() => handleInlineSave(offer)}
                                />
                                <span className="self-center text-gray-400">-</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={inlineEditData.max_quantity !== undefined ? inlineEditData.max_quantity : (offer.max_quantity || '')}
                                  onChange={(e) => handleInlineEdit(offer, 'max_quantity', e.target.value)}
                                  placeholder="Max"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                                  onBlur={() => handleInlineSave(offer)}
                                />
                              </div>
                            ) : (
                              <span className="text-sm text-gray-600">
                                {offer.min_quantity || offer.max_quantity
                                  ? `${offer.min_quantity || '0'}-${offer.max_quantity || '∞'}`
                                  : '—'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editingOfferId === offer.id ? (
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={inlineEditData.is_available !== undefined ? inlineEditData.is_available : offer.is_available}
                                  onChange={(e) => {
                                    handleInlineEdit(offer, 'is_available', e.target.checked)
                                    handleInlineSave(offer)
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className="text-xs text-gray-700">Available</span>
                              </label>
                            ) : (
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                offer.is_available
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {offer.is_available ? 'Available' : 'Unavailable'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {editingOfferId === offer.id ? (
                                <>
                                  <button
                                    onClick={() => handleInlineSave(offer)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    title="Save"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingOfferId(null)
                                      setInlineEditData({})
                                    }}
                                    className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                                    title="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingOffer(offer)
                                      setSelectedCategoryId(category.id)
                                      setOfferFormData({
                                        name: offer.name,
                                        description: offer.description || '',
                                        price: offer.price || '',
                                        price_type: offer.price_type || 'fixed',
                                        currency: offer.currency || 'EUR',
                                        unit: offer.unit || '',
                                        order: offer.order || 0,
                                        min_quantity: offer.min_quantity || '',
                                        max_quantity: offer.max_quantity || '',
                                        is_available: offer.is_available !== false,
                                        notes: offer.notes || ''
                                      })
                                      setFieldErrors({})
                                      setShowOfferForm(true)
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit offer"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Delete offer "${offer.name}"?`)) {
                                        deleteOffer.mutate(offer.id)
                                      }
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete offer"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                          <p className="mb-2">No offers in this category</p>
                          <button
                            onClick={() => {
                              setSelectedCategoryId(category.id)
                              setEditingOffer(null)
                              setOfferFormData({
                                name: '', description: '', price: '', price_type: 'fixed', currency: 'EUR',
                                unit: '', order: 0, min_quantity: '', max_quantity: '', is_available: true, notes: ''
                              })
                              setFieldErrors({})
                              setShowOfferForm(true)
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Add first offer
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedCategoryId(category.id)
                    setEditingOffer(null)
                    setOfferFormData({
                      name: '', description: '', price: '', price_type: 'fixed', currency: 'EUR',
                      unit: '', order: 0, min_quantity: '', max_quantity: '', is_available: true, notes: ''
                    })
                    setFieldErrors({})
                    setShowOfferForm(true)
                  }}
                  className="text-sm px-3 py-1.5 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 flex items-center gap-1 font-medium"
                >
                  <PlusCircle className="h-3 w-3" />
                  Add Offer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              <button 
                onClick={() => {
                  setShowCategoryForm(false)
                  setFieldErrors({})
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {fieldErrors.general && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                {fieldErrors.general}
              </div>
            )}
            <form onSubmit={(e) => {
              e.preventDefault()
              const errors = validateOffer(categoryFormData)
              if (Object.keys(errors).length > 0) {
                setFieldErrors(errors)
                return
              }
              if (editingCategory) {
                updateCategory.mutate({ id: editingCategory.id, data: categoryFormData })
              } else {
                createCategory.mutate(categoryFormData)
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  required
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                    fieldErrors.name ? 'border-red-500' : 'border-gray-400'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Description
                </label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="Optional description for this category"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Display Order
                </label>
                <input
                  type="number"
                  value={categoryFormData.order}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
                <p className="text-xs text-gray-600 mt-1">Lower numbers appear first</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false)
                    setFieldErrors({})
                  }}
                  className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offer Form Modal */}
      {showOfferForm && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingOffer ? 'Edit Offer' : 'Add Offer'}
              </h3>
              <button 
                onClick={() => {
                  setShowOfferForm(false)
                  setFieldErrors({})
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {fieldErrors.general && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                {fieldErrors.general}
              </div>
            )}
            <form onSubmit={(e) => {
              e.preventDefault()
              const errors = validateOffer(offerFormData)
              if (Object.keys(errors).length > 0) {
                setFieldErrors(errors)
                return
              }
              const payload = {
                ...offerFormData,
                price: offerFormData.price ? parseFloat(offerFormData.price) : null,
                min_quantity: offerFormData.min_quantity ? parseInt(offerFormData.min_quantity) : null,
                max_quantity: offerFormData.max_quantity ? parseInt(offerFormData.max_quantity) : null,
              }
              if (editingOffer) {
                updateOffer.mutate({ id: editingOffer.id, data: payload })
              } else {
                createOffer.mutate(payload)
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Offer Name *
                </label>
                <input
                  type="text"
                  value={offerFormData.name}
                  onChange={(e) => setOfferFormData({ ...offerFormData, name: e.target.value })}
                  required
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                    fieldErrors.name ? 'border-red-500' : 'border-gray-400'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Description
                </label>
                <textarea
                  value={offerFormData.description}
                  onChange={(e) => setOfferFormData({ ...offerFormData, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="Detailed description of this offer"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Price Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={offerFormData.price}
                    onChange={(e) => setOfferFormData({ ...offerFormData, price: e.target.value })}
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                      fieldErrors.price ? 'border-red-500' : 'border-gray-400'
                    }`}
                    placeholder="0.00"
                  />
                  {fieldErrors.price && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.price}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Price Type
                    <HelpCircle className="inline h-4 w-4 ml-1 text-gray-500" title="Fixed: exact price. Minimum Spend: minimum amount required" />
                  </label>
                  <select
                    value={offerFormData.price_type}
                    onChange={(e) => setOfferFormData({ ...offerFormData, price_type: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="minimum_spend">Minimum Spend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Currency
                  </label>
                  <select
                    value={offerFormData.currency}
                    onChange={(e) => setOfferFormData({ ...offerFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Unit (e.g., per person, per hour)
                  </label>
                  <input
                    type="text"
                    value={offerFormData.unit}
                    onChange={(e) => setOfferFormData({ ...offerFormData, unit: e.target.value })}
                    placeholder="per person, per table, etc."
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Minimum Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={offerFormData.min_quantity}
                    onChange={(e) => setOfferFormData({ ...offerFormData, min_quantity: e.target.value })}
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                      fieldErrors.min_quantity ? 'border-red-500' : 'border-gray-400'
                    }`}
                  />
                  {fieldErrors.min_quantity && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.min_quantity}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Maximum Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={offerFormData.max_quantity}
                    onChange={(e) => setOfferFormData({ ...offerFormData, max_quantity: e.target.value })}
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                      fieldErrors.max_quantity ? 'border-red-500' : 'border-gray-400'
                    }`}
                  />
                  {fieldErrors.max_quantity && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.max_quantity}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={offerFormData.is_available}
                  onChange={(e) => setOfferFormData({ ...offerFormData, is_available: e.target.checked })}
                  className="w-4 h-4"
                  id="offer-available"
                />
                <label htmlFor="offer-available" className="text-sm font-semibold text-gray-900">
                  Available
                </label>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Notes
                </label>
                <textarea
                  value={offerFormData.notes}
                  onChange={(e) => setOfferFormData({ ...offerFormData, notes: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="Additional notes or special conditions"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowOfferForm(false)
                    setFieldErrors({})
                  }}
                  className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingOffer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add to Costs Form Modal */}
      {showCostForm && costFormOffer && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Add to Costs & Budget
              </h3>
              <button 
                onClick={() => {
                  setShowCostForm(false)
                  setCostFormOffer(null)
                  setCostFormData({
                    name: '',
                    description: '',
                    amount: '',
                    currency: 'EUR',
                    category: 'Venue',
                    status: 'planned',
                    vendor_name: '',
                    vendor_contact: '',
                    notes: ''
                  })
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>From Offer:</strong> {costFormOffer.name}
                {costFormOffer.price && ` - ${costFormOffer.currency} ${parseFloat(costFormOffer.price).toFixed(2)}`}
              </p>
            </div>
            <form onSubmit={handleCostSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Cost Name *
                </label>
                <input
                  type="text"
                  value={costFormData.name}
                  onChange={(e) => setCostFormData({ ...costFormData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Description
                </label>
                <textarea
                  value={costFormData.description}
                  onChange={(e) => setCostFormData({ ...costFormData, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costFormData.amount}
                    onChange={(e) => setCostFormData({ ...costFormData, amount: e.target.value })}
                    required
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Currency
                  </label>
                  <select
                    value={costFormData.currency}
                    onChange={(e) => setCostFormData({ ...costFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Category *
                  </label>
                  <select
                    value={costFormData.category}
                    onChange={(e) => setCostFormData({ ...costFormData, category: e.target.value })}
                    required
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    <option value="Venue">Venue</option>
                    <option value="Catering">Catering</option>
                    <option value="Dress">Dress</option>
                    <option value="Photography">Photography</option>
                    <option value="Music">Music</option>
                    <option value="Décor">Décor</option>
                    <option value="Flowers">Flowers</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Hair & Makeup">Hair & Makeup</option>
                    <option value="Invitations">Invitations</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Status
                  </label>
                  <select
                    value={costFormData.status}
                    onChange={(e) => setCostFormData({ ...costFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    <option value="planned">Planned</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    value={costFormData.vendor_name}
                    onChange={(e) => setCostFormData({ ...costFormData, vendor_name: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-900">
                    Vendor Contact
                  </label>
                  <input
                    type="text"
                    value={costFormData.vendor_contact}
                    onChange={(e) => setCostFormData({ ...costFormData, vendor_contact: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-900">
                  Notes
                </label>
                <textarea
                  value={costFormData.notes}
                  onChange={(e) => setCostFormData({ ...costFormData, notes: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCostForm(false)
                    setCostFormOffer(null)
                    setCostFormData({
                      name: '',
                      description: '',
                      amount: '',
                      currency: 'EUR',
                      category: 'Venue',
                      status: 'planned',
                      vendor_name: '',
                      vendor_contact: '',
                      notes: ''
                    })
                  }}
                  className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCost.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {createCost.isPending ? 'Adding...' : 'Add to Costs'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Venue Documents Tab Component with drag-and-drop
export function VenueDocumentsTab({ venueId }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [documentNotes, setDocumentNotes] = useState({})
  const [editingNotesId, setEditingNotesId] = useState(null)

  const { data: documents, isLoading } = useQuery({
    queryKey: ['venue-documents', venueId],
    queryFn: () => api.get(`/venues/${venueId}/documents`).then(res => res.data),
    enabled: !!venueId, // Only run query if venueId is defined
  })

  const uploadDocument = useMutation({
    mutationFn: (formData) => {
      const fileName = formData.get('file').name
      return api.post(`/venues/${venueId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentComplete = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(prev => ({ ...prev, [fileName]: percentComplete }))
          }
        },
      }).then(response => response.data)
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['venue-documents', venueId])
      const fileName = variables.get('file').name
      setUploadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[fileName]
        return newProgress
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (error, variables) => {
      const fileName = variables.get('file').name
      setUploadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[fileName]
        return newProgress
      })
      const errorMessage = error.response?.data?.error || error.message || 'Upload failed'
      alert(`Failed to upload ${fileName}: ${errorMessage}`)
    },
  })

  const deleteDocument = useMutation({
    mutationFn: (id) => api.delete(`/venues/${venueId}/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue-documents', venueId])
    },
  })

  const updateDocumentNotes = useMutation({
    mutationFn: ({ id, notes }) => api.put(`/venues/${venueId}/documents/${id}`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue-documents', venueId])
      setEditingNotesId(null)
    },
  })

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFiles = (files) => {
    Array.from(files).forEach(file => {
      if (file.type === 'application/pdf' || 
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.type === 'application/msword' ||
          file.name.toLowerCase().endsWith('.pdf') ||
          file.name.toLowerCase().endsWith('.docx') ||
          file.name.toLowerCase().endsWith('.doc')) {
        const formData = new FormData()
        formData.append('file', file)
        uploadDocument.mutate(formData)
      } else {
        alert(`${file.name} is not a supported file type. Please upload PDF or DOCX files.`)
      }
    })
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  if (isLoading) return <div className="p-4">Loading documents...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Venue Documents</h3>
          <p className="text-sm text-gray-600">
            Upload PDF or DOCX files (e.g., venue brochures, pricing sheets, contracts) to enable AI-powered chat.
            Documents are automatically processed and embedded for semantic search.
          </p>
        </div>
      </div>

      {/* Drag and Drop Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-700 font-medium mb-2">
          Drag and drop PDF or DOCX files here, or click to browse
        </p>
        <p className="text-sm text-gray-500 mb-2">
          Supported formats: PDF, DOCX (Max 10MB per file)
        </p>
        <p className="text-xs text-gray-400 mb-4">
          💡 Documents are automatically parsed, chunked, and embedded for AI chat. Processing may take a few moments.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileInput}
          className="hidden"
          id="document-upload"
          multiple
        />
        <label
          htmlFor="document-upload"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-medium"
        >
          Select PDF or DOCX Files
        </label>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-900">{fileName}</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents List */}
      {documents && documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No documents uploaded yet</p>
          <p className="text-sm text-gray-500">
            Upload PDF or DOCX files to enable AI-powered chat features
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents?.map((doc) => (
            <div key={doc.id} className="border-2 border-gray-200 rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-semibold text-gray-900">{doc.original_filename}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {formatFileSize(doc.file_size)}
                        {doc.chunk_count > 0 && ` • ${doc.chunk_count} chunks processed`}
                        {doc.uploaded_by && ` • Uploaded by ${doc.uploaded_by}`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="mb-2">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      doc.status === 'processed' ? 'bg-green-100 text-green-800' :
                      doc.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      doc.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {doc.status === 'processed' && <Check className="inline h-3 w-3 mr-1" />}
                      {doc.status === 'error' && <AlertCircle className="inline h-3 w-3 mr-1" />}
                      {doc.status}
                    </span>
                  </div>

                  {/* Error Message */}
                  {doc.error_message && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm mb-2">
                      {doc.error_message}
                    </div>
                  )}

                  {/* Notes Section */}
                  <div className="mt-3">
                    {editingNotesId === doc.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={documentNotes[doc.id] || doc.notes || ''}
                          onChange={(e) => setDocumentNotes({ ...documentNotes, [doc.id]: e.target.value })}
                          rows="2"
                          className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
                          placeholder="Add notes about this document..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              updateDocumentNotes.mutate({ id: doc.id, notes: documentNotes[doc.id] || '' })
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingNotesId(null)
                              setDocumentNotes({ ...documentNotes, [doc.id]: doc.notes || '' })
                            }}
                            className="px-3 py-1 border-2 border-gray-400 text-gray-900 rounded text-sm hover:bg-gray-100 font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700">Notes:</span>
                          <button
                            onClick={() => {
                              setEditingNotesId(doc.id)
                              setDocumentNotes({ ...documentNotes, [doc.id]: doc.notes || '' })
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            {doc.notes ? 'Edit' : 'Add notes'}
                          </button>
                        </div>
                        {doc.notes && (
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{doc.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {doc.status === 'processed' && (
                    <button
                      onClick={() => {
                        // Scroll to document in chat citations
                        const event = new CustomEvent('scrollToDocument', { detail: { documentId: doc.id } })
                        window.dispatchEvent(event)
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View in chat"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete document "${doc.original_filename}"?`)) {
                        deleteDocument.mutate(doc.id)
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete document"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Venue Chat Tab Component with citations
export function VenueChatTab({ venueId }) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['venue-chat-history', venueId, sessionId],
    queryFn: () => api.get(`/venues/${venueId}/chat/history`, { params: { session_id: sessionId, limit: 50 } }).then(res => res.data),
    enabled: false, // Load manually
  })

  const sendMessage = useMutation({
    mutationFn: (message) => api.post(`/venues/${venueId}/chat`, {
      message,
      session_id: sessionId
    }),
    onSuccess: (response) => {
      const data = response.data
      setMessages(prev => [
        ...prev,
        { type: 'user', message: inputMessage, timestamp: new Date() },
        {
          type: 'assistant',
          message: data.message,
          citations: data.citations || [],
          timestamp: new Date(),
          tokens_used: data.tokens_used,
          model_used: data.model_used
        }
      ])
      setInputMessage('')
      queryClient.invalidateQueries(['venue-chat-history', venueId, sessionId])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || 'Failed to send message'
      setMessages(prev => [
        ...prev,
        { type: 'error', message: `Error: ${errorMsg}`, timestamp: new Date() }
      ])
    },
  })

  const loadHistory = () => {
    queryClient.fetchQuery(['venue-chat-history', venueId, sessionId]).then(data => {
      if (data && data.length > 0) {
        setMessages(data.map(msg => ({
          type: msg.message_type,
          message: msg.message,
          citations: msg.citations || [],
          timestamp: new Date(msg.created_at),
          tokens_used: msg.tokens_used,
          model_used: msg.model_used
        })))
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    })
  }

  useEffect(() => {
    loadHistory()
  }, [venueId, sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleScrollToDocument = (event) => {
      // Switch to documents tab and scroll to document
      const detailEvent = new CustomEvent('switchToDocumentsTab', { detail: { documentId: event.detail.documentId } })
      window.dispatchEvent(detailEvent)
    }
    window.addEventListener('scrollToDocument', handleScrollToDocument)
    return () => window.removeEventListener('scrollToDocument', handleScrollToDocument)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || sendMessage.isPending) return
    sendMessage.mutate(inputMessage)
  }

  const handleCitationClick = (citation) => {
    // Switch to documents tab and highlight the document
    const event = new CustomEvent('switchToDocumentsTab', { detail: { documentId: citation.document_id } })
    window.dispatchEvent(event)
  }

  const formatTime = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg border-2 border-gray-200">
      {/* Chat Header */}
      <div className="border-b-2 border-gray-200 p-4 bg-gray-50">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-900">AI Assistant</h3>
            <p className="text-xs text-gray-600">Ask questions about this venue based on uploaded documents</p>
          </div>
          <button
            onClick={loadHistory}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Reload History
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50">
        {historyLoading && messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Loader className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Loading conversation history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="font-medium mb-2">Start a conversation</p>
            <p className="text-sm">Ask questions about this venue. The AI will search through uploaded documents to provide answers.</p>
            <div className="mt-6 space-y-2 text-sm text-left max-w-md mx-auto">
              <p className="font-semibold text-gray-700">Example questions:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>What is the capacity of this venue?</li>
                <li>What are the catering options?</li>
                <li>What is included in the rental price?</li>
                <li>Are there any restrictions or requirements?</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-4 shadow-sm ${
                msg.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.type === 'error'
                  ? 'bg-red-50 border-2 border-red-200 text-red-800'
                  : 'bg-white border-2 border-gray-200 text-gray-900'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</div>
                
                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="text-xs font-semibold mb-2 text-gray-700">Sources:</div>
                    <div className="space-y-1">
                      {msg.citations.map((citation, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => handleCitationClick(citation)}
                          className="block text-xs text-blue-600 hover:text-blue-800 hover:underline text-left w-full"
                        >
                          [{citation.index}] {citation.filename}
                          {citation.page && ` (page ${citation.page})`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-2 pt-2 border-t border-gray-300 text-xs opacity-75">
                  {formatTime(msg.timestamp)}
                  {msg.tokens_used && ` • ${msg.tokens_used} tokens`}
                  {msg.model_used && ` • ${msg.model_used}`}
                </div>
              </div>
            </div>
          ))
        )}
        
        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border-2 border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t-2 border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask a question about this venue..."
            className="flex-1 px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
            disabled={sendMessage.isPending}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || sendMessage.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {sendMessage.isPending ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4" />
                Send
              </>
            )}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          The AI will search through uploaded documents to answer your questions
        </p>
      </div>
    </div>
  )
}
