import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { 
  PlusCircle, 
  Trash, 
  Edit, 
  Search, 
  Filter, 
  MapPin, 
  Users, 
  DollarSign,
  Star,
  Globe,
  Mail,
  Phone,
  Link as LinkIcon,
  Download,
  Upload,
  Compare,
  X,
  CheckCircle,
  Loader
} from 'lucide-react'

export default function VenuesPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedVenues, setSelectedVenues] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [scrapingUrl, setScrapingUrl] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [useLLM, setUseLLM] = useState(false)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [minCapacity, setMinCapacity] = useState('')
  const [styleFilter, setStyleFilter] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    capacity: '',
    price_range: '',
    style: '',
    amenities: [],
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    rating: '',
    notes: '',
  })

  const { data: venuesData, isLoading } = useQuery({
    queryKey: ['venues', searchTerm, minCapacity, styleFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (minCapacity) params.append('min_capacity', minCapacity)
      if (styleFilter) params.append('style', styleFilter)
      
      const response = await api.get(`/venues?${params.toString()}`)
      return response.data
    },
  })

  const venues = venuesData?.venues || []

  const createVenue = useMutation({
    mutationFn: (payload) => api.post('/venues', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['venues'])
      resetForm()
      setShowForm(false)
    },
  })

  const updateVenue = useMutation({
    mutationFn: ({ id, data }) => api.put(`/venues/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['venues'])
      resetForm()
      setShowForm(false)
      setEditingId(null)
    },
  })

  const deleteVenue = useMutation({
    mutationFn: (id) => api.delete(`/venues/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['venues']),
  })

  const scrapeVenue = useMutation({
    mutationFn: async ({ url, useLLM }) => {
      const response = await api.post('/venues/scrape', { url, use_llm: useLLM })
      return response.data
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      location: '',
      capacity: '',
      price_range: '',
      style: '',
      amenities: [],
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      website: '',
      rating: '',
      notes: '',
    })
    setEditingId(null)
    setScrapingUrl('')
  }

  const handleScrape = async () => {
    if (!scrapingUrl) {
      alert('Please enter a URL')
      return
    }
    
    setIsScraping(true)
    try {
      const data = await scrapeVenue.mutateAsync({ url: scrapingUrl, useLLM })
      
      // Populate form with scraped data
      setFormData({
        name: data.name || '',
        description: data.description || '',
        location: data.location || '',
        capacity: data.capacity || '',
        price_range: data.price_range || '',
        style: data.style || '',
        amenities: Array.isArray(data.amenities) ? data.amenities : [],
        contact_name: data.contact_name || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        website: scrapingUrl,
        rating: data.rating || '',
        notes: data.notes || '',
      })
      
      setShowForm(true)
      setScrapingUrl('')
      alert('Venue information scraped successfully! Please review and edit as needed.')
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to scrape venue information')
    } finally {
      setIsScraping(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...formData,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      rating: formData.rating ? parseFloat(formData.rating) : null,
    }
    
    if (editingId) {
      updateVenue.mutate({ id: editingId, data: payload })
    } else {
      createVenue.mutate(payload)
    }
  }

  const handleEdit = (venue) => {
    setEditingId(venue.id)
    setFormData({
      name: venue.name || '',
      description: venue.description || '',
      location: venue.location || '',
      capacity: venue.capacity || '',
      price_range: venue.price_range || '',
      style: venue.style || '',
      amenities: Array.isArray(venue.amenities) ? venue.amenities : [],
      contact_name: venue.contact_name || '',
      contact_email: venue.contact_email || '',
      contact_phone: venue.contact_phone || '',
      website: venue.website || '',
      rating: venue.rating || '',
      notes: venue.notes || '',
    })
    setShowForm(true)
  }

  const handleToggleSelect = (venueId) => {
    setSelectedVenues(prev => 
      prev.includes(venueId) 
        ? prev.filter(id => id !== venueId)
        : [...prev, venueId]
    )
  }

  const handleCompare = () => {
    if (selectedVenues.length < 2) {
      alert('Please select at least 2 venues to compare')
      return
    }
    setShowCompare(true)
  }

  const exportToCSV = () => {
    const headers = ['Name', 'Location', 'Capacity', 'Price Range', 'Style', 'Rating', 'Contact Email', 'Website']
    const rows = venues.map(v => [
      v.name || '',
      v.location || '',
      v.capacity || '',
      v.price_range || '',
      v.style || '',
      v.rating || '',
      v.contact_email || '',
      v.website || ''
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'venues.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleImportCSV = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target.result
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      
      // Map headers to venue fields
      const headerMap = {
        'Name': 'name',
        'Location': 'location',
        'Capacity': 'capacity',
        'Price Range': 'price_range',
        'Style': 'style',
        'Rating': 'rating',
        'Contact Email': 'contact_email',
        'Website': 'website',
      }

      const venuesToImport = []
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const venue = { amenities: [] }
        
        headers.forEach((header, index) => {
          const field = headerMap[header]
          if (field && values[index]) {
            if (field === 'capacity') {
              venue[field] = parseInt(values[index]) || null
            } else if (field === 'rating') {
              venue[field] = parseFloat(values[index]) || null
            } else {
              venue[field] = values[index]
            }
          }
        })
        
        if (venue.name) {
          venuesToImport.push(venue)
        }
      }

      // Import venues one by one
      let successCount = 0
      let errorCount = 0
      
      for (const venue of venuesToImport) {
        try {
          await createVenue.mutateAsync(venue)
          successCount++
        } catch (error) {
          console.error('Error importing venue:', error)
          errorCount++
        }
      }

      alert(`Import complete: ${successCount} venues imported, ${errorCount} errors`)
      queryClient.invalidateQueries(['venues'])
      
      // Reset file input
      event.target.value = ''
    }
    
    reader.readAsText(file)
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading venues...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Venue Management</h1>
          <p className="text-gray-600 mt-1">Manage and compare wedding venues</p>
        </div>
        <div className="flex gap-2">
          {selectedVenues.length >= 2 && (
            <button
              onClick={handleCompare}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Compare className="h-5 w-5" />
              Compare ({selectedVenues.length})
            </button>
          )}
          <label className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
            <Upload className="h-5 w-5" />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>
          <label className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
            <Upload className="h-5 w-5" />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="h-5 w-5" />
            Add Venue
          </button>
        </div>
      </div>

      {/* URL Scraping Section */}
      {!showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Scrape Venue from URL
          </h2>
          <div className="flex gap-2">
            <input
              type="url"
              value={scrapingUrl}
              onChange={(e) => setScrapingUrl(e.target.value)}
              placeholder="Enter venue website URL..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={useLLM}
                onChange={(e) => setUseLLM(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Use AI (ChatGPT)</span>
            </label>
            <button
              onClick={handleScrape}
              disabled={isScraping || !scrapingUrl}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isScraping ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <LinkIcon className="h-4 w-4" />
                  Scrape
                </>
              )}
            </button>
          </div>
          {useLLM && (
            <p className="text-xs text-gray-500 mt-2">
              Note: AI enhancement requires OPENAI_API_KEY to be set in backend environment
            </p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search venues..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <input
            type="number"
            value={minCapacity}
            onChange={(e) => setMinCapacity(e.target.value)}
            placeholder="Min capacity"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Styles</option>
            <option value="Rustic">Rustic</option>
            <option value="Modern">Modern</option>
            <option value="Classic">Classic</option>
            <option value="Elegant">Elegant</option>
            <option value="Beach">Beach</option>
            <option value="Garden">Garden</option>
            <option value="Industrial">Industrial</option>
            <option value="Barn">Barn</option>
            <option value="Vintage">Vintage</option>
          </select>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{editingId ? 'Edit Venue' : 'Add New Venue'}</h2>
                <button
                  onClick={() => {
                    resetForm()
                    setShowForm(false)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Capacity</label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Price Range</label>
                    <input
                      type="text"
                      value={formData.price_range}
                      onChange={(e) => setFormData({ ...formData, price_range: e.target.value })}
                      placeholder="$5,000-$10,000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Style</label>
                    <select
                      value={formData.style}
                      onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select style...</option>
                      <option value="Rustic">Rustic</option>
                      <option value="Modern">Modern</option>
                      <option value="Classic">Classic</option>
                      <option value="Elegant">Elegant</option>
                      <option value="Beach">Beach</option>
                      <option value="Garden">Garden</option>
                      <option value="Industrial">Industrial</option>
                      <option value="Barn">Barn</option>
                      <option value="Vintage">Vintage</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Amenities (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.amenities.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      amenities: e.target.value.split(',').map(a => a.trim()).filter(a => a)
                    })}
                    placeholder="Parking, Catering, Bar, Dance Floor..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rating (0-5)</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
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
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Venues Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
                  <input
                    type="checkbox"
                    checked={selectedVenues.length === venues.length && venues.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedVenues(venues.map(v => v.id))
                      } else {
                        setSelectedVenues([])
                      }
                    }}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price Range</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Style</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {venues.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    No venues found. Add your first venue!
                  </td>
                </tr>
              ) : (
                venues.map((venue) => (
                  <tr key={venue.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedVenues.includes(venue.id)}
                        onChange={() => handleToggleSelect(venue.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{venue.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {venue.location || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {venue.capacity || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {venue.price_range || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {venue.style || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {venue.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-500">{venue.rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowDetail(venue.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(venue)}
                          className="text-green-600 hover:text-green-800"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this venue?')) {
                              deleteVenue.mutate(venue.id)
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
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

      {/* Compare Modal */}
      {showCompare && (
        <CompareVenuesModal
          venueIds={selectedVenues}
          venues={venues}
          onClose={() => {
            setShowCompare(false)
            setSelectedVenues([])
          }}
        />
      )}

      {/* Detail Modal */}
      {showDetail && (
        <VenueDetailModal
          venueId={showDetail}
          onClose={() => setShowDetail(null)}
        />
      )}
    </div>
  )
}

// Compare Venues Component
function CompareVenuesModal({ venueIds, venues, onClose }) {
  const selectedVenues = venues.filter(v => venueIds.includes(v.id))
  
  const attributes = [
    { key: 'name', label: 'Name' },
    { key: 'location', label: 'Location' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'price_range', label: 'Price Range' },
    { key: 'style', label: 'Style' },
    { key: 'rating', label: 'Rating' },
    { key: 'contact_email', label: 'Contact Email' },
    { key: 'website', label: 'Website' },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Compare Venues</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left border-b">Attribute</th>
                  {selectedVenues.map(venue => (
                    <th key={venue.id} className="px-4 py-2 text-left border-b font-semibold">
                      {venue.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attributes.map(attr => (
                  <tr key={attr.key} className="border-b">
                    <td className="px-4 py-2 font-medium">{attr.label}</td>
                    {selectedVenues.map(venue => {
                      const value = venue[attr.key]
                      return (
                        <td key={venue.id} className="px-4 py-2">
                          {value || '-'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-2 font-medium">Amenities</td>
                  {selectedVenues.map(venue => (
                    <td key={venue.id} className="px-4 py-2">
                      {Array.isArray(venue.amenities) && venue.amenities.length > 0 ? (
                        <ul className="list-disc list-inside text-sm">
                          {venue.amenities.slice(0, 5).map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      ) : '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// Venue Detail Component
function VenueDetailModal({ venueId, onClose }) {
  const { data: venue, isLoading } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: async () => {
      const response = await api.get(`/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
  })

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">Loading...</div>
      </div>
    )
  }

  if (!venue) return null
    queryKey: ['venue', venueId],
    queryFn: async () => {
      const response = await api.get(`/venues/${venueId}`)
      return response.data
    },
  })

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">Loading...</div>
      </div>
    )
  }

  if (!venue) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{venue.name}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            {venue.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-600">{venue.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </h3>
                <p className="text-gray-600">{venue.location || '-'}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Capacity
                </h3>
                <p className="text-gray-600">{venue.capacity || '-'}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Price Range
                </h3>
                <p className="text-gray-600">{venue.price_range || '-'}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Rating
                </h3>
                <p className="text-gray-600">{venue.rating ? `${venue.rating.toFixed(1)}/5.0` : '-'}</p>
              </div>
            </div>

            {Array.isArray(venue.amenities) && venue.amenities.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {venue.amenities.map((amenity, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Contact Information</h3>
              <div className="space-y-2">
                {venue.contact_name && <p className="text-gray-600">{venue.contact_name}</p>}
                {venue.contact_email && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {venue.contact_email}
                  </p>
                )}
                {venue.contact_phone && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {venue.contact_phone}
                  </p>
                )}
                {venue.website && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {venue.website}
                    </a>
                  </p>
                )}
              </div>
            </div>

            {venue.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-gray-600">{venue.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

