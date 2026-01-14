// Venue Setup Wizard Component
import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'

export default function VenueSetupWizard({
  wizardStep,
  setWizardStep,
  wizardData,
  setWizardData,
  skipScrape,
  setSkipScrape,
  scrapingUrl,
  setScrapingUrl,
  isScraping,
  setIsScraping,
  useLLM,
  setUseLLM,
  scrapeVenue,
  createVenue,
  onClose
}) {
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

  // Initialize form data from wizardData if available
  useEffect(() => {
    if (wizardData.venueDetails) {
      setFormData(wizardData.venueDetails)
    } else if (wizardData.basicInfo) {
      setFormData({
        name: wizardData.basicInfo.name || '',
        description: wizardData.basicInfo.description || '',
        address: wizardData.basicInfo.address || '',
        city: wizardData.basicInfo.city || '',
        region: wizardData.basicInfo.region || '',
        location: wizardData.basicInfo.location || '',
        capacity_min: wizardData.basicInfo.capacity_min || '',
        capacity_max: wizardData.basicInfo.capacity_max || wizardData.basicInfo.capacity || '',
        capacity: wizardData.basicInfo.capacity || '',
        price_min: wizardData.basicInfo.price_min || '',
        price_max: wizardData.basicInfo.price_max || '',
        price_range: wizardData.basicInfo.price_range || '',
        style: wizardData.basicInfo.style || '',
        amenities: Array.isArray(wizardData.basicInfo.amenities) ? wizardData.basicInfo.amenities : [],
        contact_name: wizardData.basicInfo.contact_name || '',
        contact_email: wizardData.basicInfo.contact_email || '',
        contact_phone: wizardData.basicInfo.contact_phone || '',
        website: wizardData.basicInfo.website || '',
        external_url: wizardData.basicInfo.external_url || '',
        rating: wizardData.basicInfo.rating || '',
        available_dates: Array.isArray(wizardData.basicInfo.available_dates) ? wizardData.basicInfo.available_dates : [],
        images: Array.isArray(wizardData.basicInfo.images) ? wizardData.basicInfo.images : [],
        notes: wizardData.basicInfo.notes || '',
      })
    }
  }, [wizardData])

  // Step 1: Scrape or Manual Entry
  const handleStep1Scrape = async () => {
    if (!scrapingUrl) {
      alert('Please enter a URL')
      return
    }
    try {
      new URL(scrapingUrl)
    } catch {
      alert('Invalid URL format. Please enter a valid URL starting with http:// or https://')
      return
    }
    
    setIsScraping(true)
    try {
      const data = await scrapeVenue.mutateAsync({ url: scrapingUrl, useLLM })
      if (data.error) {
        alert(`Scraping failed: ${data.error}`)
        setIsScraping(false)
        return
      }
      setWizardData(prev => ({ ...prev, basicInfo: data }))
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
      setWizardStep(2)
      setScrapingUrl('')
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to scrape venue information')
    } finally {
      setIsScraping(false)
    }
  }

  const handleStep1Skip = () => {
    setSkipScrape(true)
    setWizardStep(2)
  }

  // Step 2: Edit Venue Details
  const handleStep2Next = () => {
    if (!formData.name) {
      alert('Please enter a venue name')
      return
    }
    setWizardData(prev => ({ ...prev, venueDetails: formData }))
    setWizardStep(3)
  }

  // Step 3: Upload Documents (placeholder - documents will be uploaded after venue creation)
  const handleStep3Next = () => {
    setWizardStep(4)
  }

  // Step 4: Add Offers (placeholder - offers will be added after venue creation)
  const handleStep4Next = () => {
    setWizardStep(5)
  }

  // Step 5: Review & Save
  const handleStep5Save = () => {
    const payload = {
      ...formData,
      capacity_min: formData.capacity_min ? parseInt(formData.capacity_min) : null,
      capacity_max: formData.capacity_max ? parseInt(formData.capacity_max) : null,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      price_min: formData.price_min ? parseFloat(formData.price_min) : null,
      price_max: formData.price_max ? parseFloat(formData.price_max) : null,
      rating: formData.rating ? parseFloat(formData.rating) : null,
    }
    createVenue.mutate(payload, {
      onSuccess: () => {
        alert('Venue created successfully! You can now add documents and offers in the venue details.')
        onClose()
      }
    })
  }

  const steps = [
    { number: 1, title: 'Scrape or Enter', description: 'Get venue info from URL or enter manually' },
    { number: 2, title: 'Edit Details', description: 'Review and edit venue information' },
    { number: 3, title: 'Upload Documents', description: 'Add PDFs and documents (optional)' },
    { number: 4, title: 'Add Offers', description: 'Add pricing and offers (optional)' },
    { number: 5, title: 'Review & Save', description: 'Review all information and save' },
  ]

  return (
    <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Venue Setup Wizard</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-between mb-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    wizardStep > step.number
                      ? 'bg-green-500 text-white'
                      : wizardStep === step.number
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {wizardStep > step.number ? <Check className="h-5 w-5" /> : step.number}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-xs font-medium ${
                      wizardStep >= step.number ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 ${
                    wizardStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="mb-6">
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Step 1: Get Venue Information</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-4">
                    You can scrape venue information from a website URL or enter it manually.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Venue Website URL</label>
                      <input
                        type="url"
                        value={scrapingUrl}
                        onChange={(e) => setScrapingUrl(e.target.value)}
                        placeholder="https://example-venue.com"
                        className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        disabled={isScraping}
                      />
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={useLLM}
                        onChange={(e) => setUseLLM(e.target.checked)}
                        className="w-4 h-4"
                        disabled={isScraping}
                      />
                      <span className="text-sm text-gray-700">Use AI enhancement (requires OpenAI API key)</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleStep1Scrape}
                        disabled={isScraping || !scrapingUrl}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                      >
                        {isScraping ? 'Scraping...' : 'Scrape from URL'}
                      </button>
                      <button
                        onClick={handleStep1Skip}
                        className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                      >
                        Enter Manually
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Step 2: Edit Venue Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Venue Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Style</label>
                    <select
                      value={formData.style}
                      onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
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
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Capacity</label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleStep2Next}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Step 3: Upload Documents</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-4">
                    Documents can be uploaded after the venue is created. You can add PDFs, DOCX files, and other documents in the venue details.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleStep3Next}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Skip & Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Step 4: Add Offers</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-4">
                    Offers can be added after the venue is created. You can add pricing categories and individual offers in the venue details.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setWizardStep(3)}
                      className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleStep4Next}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Skip & Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Step 5: Review & Save</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                  <p><strong>Name:</strong> {formData.name || 'Not set'}</p>
                  <p><strong>Style:</strong> {formData.style || 'Not set'}</p>
                  <p><strong>City:</strong> {formData.city || 'Not set'}</p>
                  <p><strong>Capacity:</strong> {formData.capacity || 'Not set'}</p>
                  <p><strong>Description:</strong> {formData.description || 'Not set'}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setWizardStep(4)}
                    className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleStep5Save}
                    disabled={createVenue.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                  >
                    {createVenue.isPending ? 'Saving...' : 'Save Venue'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
