import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { 
  PlusCircle, 
  Trash, 
  Edit, 
  Search, 
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
  GitCompare,
  X,
  Loader,
  Image as ImageIcon,
  Calendar,
  Check
} from 'lucide-react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { VenueOffersTab, VenueDocumentsTab, VenueChatTab } from './VenuesPageComponents'

export default function VenuesPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [editingId, setEditingId] = useState(null)
  const [selectedVenues, setSelectedVenues] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [scrapingUrl, setScrapingUrl] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [useLLM, setUseLLM] = useState(false)
  const [skipScrape, setSkipScrape] = useState(false)
  const fileInputRef = useRef(null)
  const csvFileInputRef = useRef(null)
  const [imagePreviews, setImagePreviews] = useState([])
  const [wizardData, setWizardData] = useState({
    // Step 1: Basic info (scraped or manual)
    basicInfo: null,
    // Step 2: Venue details
    venueDetails: null,
    // Step 3: Documents (will be uploaded)
    documents: [],
    // Step 4: Offers (will be added)
    offers: [],
    // Step 5: Review
  })
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [minCapacity, setMinCapacity] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [styleFilter, setStyleFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    region: '',
    location: '',
    capacity_min: '',
    capacity_max: '',
    capacity: '',
    price_min: '',
    price_max: '',
    price_range: '',
    style: '',
    amenities: [],
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    external_url: '',
    rating: '',
    available_dates: [],
    images: [],
    notes: '',
  })

  const { data: venuesData, isLoading } = useQuery({
    queryKey: ['venues', searchTerm, minCapacity, maxCapacity, minPrice, maxPrice, styleFilter, cityFilter, regionFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (minCapacity) params.append('min_capacity', minCapacity)
      if (maxCapacity) params.append('max_capacity', maxCapacity)
      if (minPrice) params.append('min_price', minPrice)
      if (maxPrice) params.append('max_price', maxPrice)
      if (styleFilter) params.append('style', styleFilter)
      if (cityFilter) params.append('city', cityFilter)
      if (regionFilter) params.append('region', regionFilter)
      
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

  const exportCSV = useMutation({
    mutationFn: async () => {
      const response = await api.get('/venues/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `venues_export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })

  const importCSV = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post('/venues/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['venues'])
      alert(`Successfully imported ${data.imported} venues. ${data.errors.length > 0 ? `Errors: ${data.errors.join(', ')}` : ''}`)
      if (csvFileInputRef.current) csvFileInputRef.current.value = ''
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Failed to import CSV')
    }
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      address: '',
      city: '',
      region: '',
      location: '',
      capacity_min: '',
      capacity_max: '',
      capacity: '',
      price_min: '',
      price_max: '',
      price_range: '',
      style: '',
      amenities: [],
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      website: '',
      external_url: '',
      rating: '',
      available_dates: [],
      images: [],
      notes: '',
    })
    setEditingId(null)
    setScrapingUrl('')
    setImagePreviews([])
  }

  const handleScrape = async () => {
    if (!scrapingUrl) {
      alert('Please enter a URL')
      return
    }
    
    // Validate URL format
    try {
      new URL(scrapingUrl)
    } catch {
      alert('Invalid URL format. Please enter a valid URL starting with http:// or https://')
      return
    }
    
    setIsScraping(true)
    try {
      const data = await scrapeVenue.mutateAsync({ url: scrapingUrl, useLLM })
      
      // Check for errors in response
      if (data.error) {
        let errorMsg = data.error
        if (errorMsg.includes('timeout')) {
          errorMsg = 'The website took too long to respond. Please try again or enter the information manually.'
        } else if (errorMsg.includes('Connection') || errorMsg.includes('reach')) {
          errorMsg = 'Could not reach the website. Please check the URL and your internet connection, or enter the information manually.'
        } else if (errorMsg.includes('HTTP error')) {
          errorMsg = `Could not access the website: ${errorMsg}. Please check the URL or enter the information manually.`
        }
        alert(`Scraping failed: ${errorMsg}`)
        setIsScraping(false)
        return
      }
      
      // Populate form with scraped data
      setFormData({
        name: data.name || '',
        description: data.description || '',
        address: data.address || '',
        city: data.city || '',
        region: data.region || '',
        location: data.location || '',
        capacity_min: data.capacity_min || '',
        capacity_max: data.capacity_max || data.capacity || '',
        capacity: data.capacity || '',
        price_min: data.price_min || '',
        price_max: data.price_max || '',
        price_range: data.price_range || '',
        style: data.style || '',
        amenities: Array.isArray(data.amenities) ? data.amenities : [],
        contact_name: data.contact_name || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        website: scrapingUrl,
        external_url: data.external_url || '',
        rating: data.rating || '',
        available_dates: Array.isArray(data.available_dates) ? data.available_dates : [],
        images: Array.isArray(data.images) ? data.images : [],
        notes: data.notes || '',
      })
      
      setShowForm(true)
      setScrapingUrl('')
      
      // Show warning if LLM had issues but basic scraping worked
      if (data.llm_warning) {
        alert(`Venue information scraped successfully!\n\nNote: ${data.llm_warning}\n\nBasic scraping data is available. Please review and edit as needed.`)
      } else {
        alert('Venue information scraped successfully! Please review and edit as needed.')
      }
    } catch (error) {
      let errorMsg = error.response?.data?.error || error.message || 'Failed to scrape venue information'
      if (errorMsg.includes('timeout')) {
        errorMsg = 'The website took too long to respond. Please try again or enter the information manually.'
      } else if (errorMsg.includes('Connection') || errorMsg.includes('reach')) {
        errorMsg = 'Could not reach the website. Please check the URL and your internet connection, or enter the information manually.'
      }
      alert(`Scraping failed: ${errorMsg}`)
    } finally {
      setIsScraping(false)
    }
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setImagePreviews(prev => [...prev, event.target.result])
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, event.target.result]
          }))
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const removeImage = (index) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...formData,
      capacity_min: formData.capacity_min ? parseInt(formData.capacity_min) : null,
      capacity_max: formData.capacity_max ? parseInt(formData.capacity_max) : null,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      price_min: formData.price_min ? parseFloat(formData.price_min) : null,
      price_max: formData.price_max ? parseFloat(formData.price_max) : null,
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
      address: venue.address || '',
      city: venue.city || '',
      region: venue.region || '',
      location: venue.location || '',
      capacity_min: venue.capacity_min || '',
      capacity_max: venue.capacity_max || '',
      capacity: venue.capacity || '',
      price_min: venue.price_min || '',
      price_max: venue.price_max || '',
      price_range: venue.price_range || '',
      style: venue.style || '',
      amenities: Array.isArray(venue.amenities) ? venue.amenities : [],
      contact_name: venue.contact_name || '',
      contact_email: venue.contact_email || '',
      contact_phone: venue.contact_phone || '',
      website: venue.website || '',
      external_url: venue.external_url || '',
      rating: venue.rating || '',
      available_dates: Array.isArray(venue.available_dates) ? venue.available_dates : [],
      images: Array.isArray(venue.images) ? venue.images : [],
      notes: venue.notes || '',
    })
    setImagePreviews(Array.isArray(venue.images) ? venue.images : [])
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

  const handleCSVImport = (e) => {
    const file = e.target.files[0]
    if (file && file.name.endsWith('.csv')) {
      importCSV.mutate(file)
    } else {
      alert('Please select a CSV file')
    }
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
        <div className="flex gap-2 flex-wrap">
          {selectedVenues.length >= 2 && (
            <button
              onClick={handleCompare}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <GitCompare className="h-5 w-5" />
              Compare ({selectedVenues.length})
            </button>
          )}
          <label className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
            <Upload className="h-5 w-5" />
            Import CSV
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
          </label>
          <button
            onClick={() => exportCSV.mutate()}
            disabled={exportCSV.isPending}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {exportCSV.isPending ? <Loader className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Export CSV
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowWizard(true)
              setWizardStep(1)
              setWizardData({
                basicInfo: null,
                venueDetails: null,
                documents: [],
                offers: [],
              })
              setSkipScrape(false)
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
            />
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={useLLM}
                onChange={(e) => setUseLLM(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium">Use AI (ChatGPT)</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search venues..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={minCapacity}
              onChange={(e) => setMinCapacity(e.target.value)}
              placeholder="Min capacity"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
            />
            <input
              type="number"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              placeholder="Max capacity"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min price"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
            />
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max price"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
            />
          </div>
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <input
            type="text"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Filter by city..."
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
          />
          <input
            type="text"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            placeholder="Filter by region..."
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
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
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Venue Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Enter the full name of the venue"
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                    />
                    <p className="text-xs text-gray-600 mt-1">The official name of the wedding venue</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Venue Style</label>
                    <select
                      value={formData.style}
                      onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    >
                      <option value="">Select venue style...</option>
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
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    placeholder="Enter a detailed description of the venue, its features, and ambiance..."
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                  />
                  <p className="text-xs text-gray-600 mt-1">Describe the venue's atmosphere, unique features, and what makes it special</p>
                </div>

                {/* Location */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Location</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Street Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="e.g., 123 Main Street"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Full street address</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">City</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g., New York"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">City name</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Region/State</label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        placeholder="e.g., NY or California"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">State, province, or region</p>
                    </div>
                  </div>
                </div>

                {/* Capacity */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Capacity</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Minimum Capacity</label>
                      <input
                        type="number"
                        value={formData.capacity_min}
                        onChange={(e) => setFormData({ ...formData, capacity_min: e.target.value })}
                        placeholder="e.g., 50"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Minimum number of guests</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Maximum Capacity</label>
                      <input
                        type="number"
                        value={formData.capacity_max}
                        onChange={(e) => setFormData({ ...formData, capacity_max: e.target.value })}
                        placeholder="e.g., 300"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Maximum number of guests</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Capacity (Legacy)</label>
                      <input
                        type="number"
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Minimum Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_min}
                        onChange={(e) => setFormData({ ...formData, price_min: e.target.value })}
                        placeholder="e.g., 5000"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Lowest price in USD</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Maximum Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_max}
                        onChange={(e) => setFormData({ ...formData, price_max: e.target.value })}
                        placeholder="e.g., 10000"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Highest price in USD</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Price Range (Text)</label>
                      <input
                        type="text"
                        value={formData.price_range}
                        onChange={(e) => setFormData({ ...formData, price_range: e.target.value })}
                        placeholder="e.g., $5,000-$10,000 or Budget/Mid-range/Premium"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Text description of price range</p>
                    </div>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Amenities</label>
                  <input
                    type="text"
                    value={formData.amenities.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      amenities: e.target.value.split(',').map(a => a.trim()).filter(a => a)
                    })}
                    placeholder="Parking, Catering, Bar, Dance Floor, Outdoor Space, Bridal Suite..."
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                  />
                  <p className="text-xs text-gray-600 mt-1">Separate multiple amenities with commas</p>
                </div>

                {/* Contact Information */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Contact Person Name</label>
                      <input
                        type="text"
                        value={formData.contact_name}
                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                        placeholder="e.g., John Smith"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Primary contact person</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={formData.contact_email}
                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                        placeholder="e.g., info@venue.com"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Email address for inquiries</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        value={formData.contact_phone}
                        onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                        placeholder="e.g., +1 234 567 8900"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-600 mt-1">Phone number with country code</p>
                    </div>
                  </div>
                </div>

                {/* Website & Rating */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Website URL</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://www.venue.com"
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                    />
                    <p className="text-xs text-gray-600 mt-1">Main website URL</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">External/Scraped URL</label>
                    <input
                      type="url"
                      value={formData.external_url}
                      onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                      placeholder="https://www.venue.com/weddings"
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                    />
                    <p className="text-xs text-gray-600 mt-1">Original scraped URL</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Rating (0-5)</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                      placeholder="e.g., 4.5"
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                    />
                    <p className="text-xs text-gray-600 mt-1">Rating from reviews (0.0 to 5.0)</p>
                  </div>
                </div>

                {/* Available Dates */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Available Dates
                  </label>
                  <input
                    type="text"
                    value={formData.available_dates.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      available_dates: e.target.value.split(',').map(d => d.trim()).filter(d => d)
                    })}
                    placeholder="2024-06-15, 2024-07-20, 2024-08-10"
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                  />
                  <p className="text-xs text-gray-600 mt-1">Separate dates with commas, format: YYYY-MM-DD</p>
                </div>

                {/* Images */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Images
                  </label>
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                    <input
                      type="text"
                      value={formData.images.join(', ')}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        images: e.target.value.split(',').map(img => img.trim()).filter(img => img)
                      })}
                      placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                    />
                    <p className="text-xs text-gray-600">Upload files or enter image URLs separated by commas</p>
                    {imagePreviews.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative">
                            <img src={preview} alt={`Preview ${index}`} className="w-full h-24 object-cover rounded" />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes, special requirements, or important information about this venue..."
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600"
                      rows="3"
                    />
                </div>

                <div className="flex justify-end gap-2 mt-6">
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
                      {venue.imported_via_scraper && (
                        <span className="text-xs text-blue-600">(Scraped)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {venue.city && venue.region ? `${venue.city}, ${venue.region}` : venue.location || venue.address || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {venue.capacity_min && venue.capacity_max 
                          ? `${venue.capacity_min}-${venue.capacity_max}` 
                          : venue.capacity_max || venue.capacity || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {venue.price_min && venue.price_max 
                          ? `$${venue.price_min}-$${venue.price_max}` 
                          : venue.price_range || '-'}
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

// Compare Venues Component with Charts
function CompareVenuesModal({ venueIds, venues, onClose }) {
  const selectedVenues = venues.filter(v => venueIds.includes(v.id))
  
  // Prepare data for charts
  const radarData = selectedVenues.map(venue => ({
    name: venue.name,
    Capacity: venue.capacity_max || venue.capacity || 0,
    Rating: (venue.rating || 0) * 20, // Scale to 0-100
    Price: venue.price_max ? Math.min(venue.price_max / 100, 100) : 0, // Normalize
  }))

  const barData = selectedVenues.map(venue => ({
    name: venue.name.length > 15 ? venue.name.substring(0, 15) + '...' : venue.name,
    Capacity: venue.capacity_max || venue.capacity || 0,
    Rating: venue.rating || 0,
    Price: venue.price_max || venue.price_min || 0,
  }))

  const attributes = [
    { key: 'name', label: 'Name' },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'region', label: 'Region' },
    { key: 'capacity_min', label: 'Min Capacity' },
    { key: 'capacity_max', label: 'Max Capacity' },
    { key: 'price_min', label: 'Min Price' },
    { key: 'price_max', label: 'Max Price' },
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

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Capacity & Rating Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Capacity" fill="#8884d8" />
                  <Bar dataKey="Rating" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Multi-Attribute Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  {selectedVenues.map((venue, index) => (
                    <Radar
                      key={venue.id}
                      name={venue.name}
                      dataKey={index === 0 ? 'Capacity' : index === 1 ? 'Rating' : 'Price'}
                      stroke={`hsl(${index * 60}, 70%, 50%)`}
                      fill={`hsl(${index * 60}, 70%, 50%)`}
                      fillOpacity={0.6}
                    />
                  ))}
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Table */}
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

// Venue Detail Component with Request Tracking
function VenueDetailModal({ venueId, onClose }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('details')
  const [showRequestForm, setShowRequestForm] = useState(false)
  
  // Handle tab switching from chat citations
  useEffect(() => {
    const handleSwitchTab = (event) => {
      if (event.detail.documentId) {
        setActiveTab('documents')
        // Scroll to document after a brief delay
        setTimeout(() => {
          const element = document.getElementById(`document-${event.detail.documentId}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2')
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2')
            }, 2000)
          }
        }, 300)
      }
    }
    window.addEventListener('switchToDocumentsTab', handleSwitchTab)
    return () => window.removeEventListener('switchToDocumentsTab', handleSwitchTab)
  }, [])
  
  const [requestFormData, setRequestFormData] = useState({
    contact_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    proposed_price: '',
    notes: ''
  })

  const { data: venue, isLoading } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: async () => {
      const response = await api.get(`/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
  })

  const createRequest = useMutation({
    mutationFn: (data) => api.post(`/venues/${venueId}/requests`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue', venueId])
      setShowRequestForm(false)
      setRequestFormData({
        contact_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        proposed_price: '',
        currency: 'EUR',
        notes: ''
      })
    },
  })

  const updateRequest = useMutation({
    mutationFn: ({ id, data }) => api.put(`/venues/requests/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue', venueId])
    },
  })

  const deleteRequest = useMutation({
    mutationFn: (id) => api.delete(`/venues/requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['venue', venueId])
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

  const requests = venue.requests || []

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

          {/* Tabs */}
          <div className="border-b mb-4">
            <div className="flex gap-4 overflow-x-auto">
              <button
                onClick={() => setActiveTab('details')}
                className={`pb-2 px-4 font-medium whitespace-nowrap ${
                  activeTab === 'details'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('offers')}
                className={`pb-2 px-4 font-medium whitespace-nowrap ${
                  activeTab === 'offers'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Offers
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`pb-2 px-4 font-medium whitespace-nowrap ${
                  activeTab === 'documents'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Documents
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`pb-2 px-4 font-medium whitespace-nowrap ${
                  activeTab === 'chat'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`pb-2 px-4 font-medium whitespace-nowrap ${
                  activeTab === 'requests'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Communication History ({requests.length})
              </button>
            </div>
          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
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
                <p className="text-gray-600">
                  {venue.address && <div>{venue.address}</div>}
                  {venue.city && venue.region && <div>{venue.city}, {venue.region}</div>}
                  {!venue.address && !venue.city && (venue.location || '-')}
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Capacity
                </h3>
                <p className="text-gray-600">
                  {venue.capacity_min && venue.capacity_max 
                    ? `${venue.capacity_min}-${venue.capacity_max}` 
                    : venue.capacity_max || venue.capacity || '-'}
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Price Range
                </h3>
                <p className="text-gray-600">
                  {venue.price_min && venue.price_max 
                    ? `$${venue.price_min}-$${venue.price_max}` 
                    : venue.price_range || '-'}
                </p>
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

            {Array.isArray(venue.images) && venue.images.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Images
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {venue.images.map((img, i) => (
                    <img key={i} src={img} alt={`Venue ${i}`} className="w-full h-32 object-cover rounded" />
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
          )}

          {/* Offers Tab */}
          {activeTab === 'offers' && (
            <VenueOffersTab venueId={venueId} />
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <VenueDocumentsTab venueId={venueId} />
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <VenueChatTab venueId={venueId} />
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Communication History</h3>
                <button
                  onClick={() => setShowRequestForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Request
                </button>
              </div>

              {/* Request Form Modal */}
              {showRequestForm && (
                <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Add Venue Request</h3>
                      <button onClick={() => setShowRequestForm(false)}>
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault()
                      createRequest.mutate(requestFormData)
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Contact Date *</label>
                        <input
                          type="date"
                          value={requestFormData.contact_date}
                          onChange={(e) => setRequestFormData({ ...requestFormData, contact_date: e.target.value })}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select
                          value={requestFormData.status}
                          onChange={(e) => setRequestFormData({ ...requestFormData, status: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        >
                          <option value="pending">Pending</option>
                          <option value="contacted">Contacted</option>
                          <option value="proposal_received">Proposal Received</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Proposed Price (EUR)</label>
                        <div className="flex gap-2">
                          <select
                            value={requestFormData.currency || 'EUR'}
                            onChange={(e) => setRequestFormData({ ...requestFormData, currency: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                          >
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                            <option value="CHF">CHF</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            value={requestFormData.proposed_price}
                            onChange={(e) => setRequestFormData({ ...requestFormData, proposed_price: e.target.value })}
                            placeholder="0.00"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Enter the proposed price from the venue</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <textarea
                          value={requestFormData.notes}
                          onChange={(e) => setRequestFormData({ ...requestFormData, notes: e.target.value })}
                          rows="3"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRequestForm(false)}
                          className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Add Request
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Requests List */}
              {requests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No communication history yet. Add your first request!</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold">{new Date(request.contact_date).toLocaleDateString()}</div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            request.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            request.status === 'proposal_received' ? 'bg-blue-100 text-blue-800' :
                            request.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {request.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const newStatus = prompt('Enter new status (pending, contacted, proposal_received, accepted, rejected):', request.status)
                              if (newStatus) {
                                updateRequest.mutate({ id: request.id, data: { status: newStatus } })
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this request?')) {
                                deleteRequest.mutate(request.id)
                              }
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {request.proposed_price && (
                        <div className="text-sm text-gray-600 mb-1">
                          Proposed Price: ${parseFloat(request.proposed_price).toFixed(2)}
                        </div>
                      )}
                      {request.notes && (
                        <div className="text-sm text-gray-600">{request.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
