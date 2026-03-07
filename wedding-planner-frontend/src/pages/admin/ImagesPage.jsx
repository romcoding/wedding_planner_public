import React, { useEffect, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Image as ImageIcon, Upload, X, Clock, GripVertical, ChevronUp, ChevronDown, Wand2 } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import {
  Church,
  Wine,
  Utensils,
  Cake,
  Music,
  Camera,
  Heart,
  Sparkles,
  Car,
  Hotel,
} from 'lucide-react'

// Custom interlacing wedding rings icon
const WeddingRings = ({ className, style, strokeWidth = 1.75, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    {...props}
  >
    <circle cx="9" cy="12" r="5" />
    <circle cx="15" cy="12" r="5" />
  </svg>
)

// Get emoji for icon (used in agenda item display)
const getIconEmoji = (iconName) => {
  const icons = {
    church: '⛪',
    rings: '💍',
    champagne: '🥂',
    utensils: '🍽️',
    cake: '🎂',
    music: '🎵',
    camera: '📷',
    heart: '❤️',
    sparkles: '✨',
    car: '🚗',
    hotel: '🏨',
  }
  return icons[iconName] || ''
}

export const getAgendaIcon = (iconName, props = {}) => {
  const iconProps = {
    className: 'w-4 h-4',
    style: { color: 'var(--wp-primary)' },
    strokeWidth: 1.75,
    ...props,
  }

  const icons = {
    church: <Church {...iconProps} />,
    rings: <WeddingRings {...iconProps} />,
    champagne: <Wine {...iconProps} />,
    utensils: <Utensils {...iconProps} />,
    cake: <Cake {...iconProps} />,
    music: <Music {...iconProps} />,
    camera: <Camera {...iconProps} />,
    heart: <Heart {...iconProps} />,
    sparkles: <Sparkles {...iconProps} />,
    car: <Car {...iconProps} />,
    hotel: <Hotel {...iconProps} />,
  }

  return icons[iconName] || null
}

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

  const THEME_KEYS = {
    primary: 'theme_primary',
    secondary: 'theme_secondary',
    accent: 'theme_accent',
    background: 'theme_background',
    text: 'theme_text',
  }

  const [theme, setTheme] = useState({
    primary: '#EC4899',
    secondary: '#7C3AED',
    accent: '#111827',
    background: '#FFFFFF',
    text: '#111827',
  })

  // Guest portal items (accommodation + timeline agenda)
  const [guestEventId, setGuestEventId] = useState('')
  
  // Agenda items state
  const [showAgendaForm, setShowAgendaForm] = useState(false)
  const [editingAgendaId, setEditingAgendaId] = useState(null)
  const [agendaForm, setAgendaForm] = useState({
    time_display: '',
    title_en: '',
    title_de: '',
    title_fr: '',
    description_en: '',
    description_de: '',
    description_fr: '',
    icon: '',
  })
  const [guestEventDetails, setGuestEventDetails] = useState({ en: '', de: '', fr: '' })
  const [guestTimelineVenueId, setGuestTimelineVenueId] = useState('')
  const [guestAgenda, setGuestAgenda] = useState({ en: '', de: '', fr: '' })
  const [newAgendaItem, setNewAgendaItem] = useState({ en: '', de: '', fr: '' })
  const [guestDresscode, setGuestDresscode] = useState({ en: '', de: '', fr: '' })
  const [guestAccommodationVenueId, setGuestAccommodationVenueId] = useState('')
  const [guestAccommodationDetails, setGuestAccommodationDetails] = useState({ en: '', de: '', fr: '' })
  const [guestAccommodationBookingLink, setGuestAccommodationBookingLink] = useState('')
  
  // Gift Registry state
  const [giftIban, setGiftIban] = useState({ en: '', de: '', fr: '' })
  const [giftMessage, setGiftMessage] = useState({ en: '', de: '', fr: '' })
  const [giftAccountHolder, setGiftAccountHolder] = useState({ en: '', de: '', fr: '' })
  
  // Witnesses (Maid of Honor & Best Man)
  const [witnesses, setWitnesses] = useState([])

  // Bride & Groom contact cards
  const [coupleCards, setCoupleCards] = useState([])
  
  const didInitGuestCardsRef = useRef(false)

  const { data: contentItems } = useQuery({
    queryKey: ['content', 'admin'],
    queryFn: () => api.get('/content?lang=en').then((r) => r.data),
  })

  const { data: guestPortalSettings } = useQuery({
    queryKey: ['events', 'guest-portal-settings'],
    queryFn: () => api.get('/events/guest-portal-settings').then((r) => r.data),
    retry: false,
  })

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then((r) => r.data),
  })

  const sortedEvents = Array.isArray(events)
    ? [...events].sort((a, b) => {
        const da = new Date(a.start_time)
        const db = new Date(b.start_time)
        return da - db
      })
    : []

  const { data: venuesData } = useQuery({
    queryKey: ['venues', 'all'],
    queryFn: () => api.get('/venues').then((res) => res.data),
  })
  const venues = Array.isArray(venuesData?.venues) ? venuesData.venues : []

  // Agenda items queries and mutations
  const { data: agendaItems, isLoading: agendaLoading } = useQuery({
    queryKey: ['agenda', 'admin'],
    queryFn: () => api.get('/agenda/admin').then((r) => r.data),
  })

  const createAgendaItem = useMutation({
    mutationFn: (data) => api.post('/agenda', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agenda'])
      setShowAgendaForm(false)
      resetAgendaForm()
      toast.success('Agenda item created')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to create agenda item'),
  })

  const updateAgendaItem = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/agenda/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['agenda'])
      setShowAgendaForm(false)
      setEditingAgendaId(null)
      resetAgendaForm()
      toast.success('Agenda item updated')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to update agenda item'),
  })

  const deleteAgendaItem = useMutation({
    mutationFn: (id) => api.delete(`/agenda/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['agenda'])
      toast.success('Agenda item deleted')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to delete agenda item'),
  })

  const resetAgendaForm = () => {
    setAgendaForm({
      time_display: '',
      title_en: '',
      title_de: '',
      title_fr: '',
      description_en: '',
      description_de: '',
      description_fr: '',
      icon: '',
    })
  }

  const parseAgendaItems = (value) =>
    String(value || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

  const updateAgendaItems = (lang, items) => {
    setGuestAgenda((prev) => ({
      ...prev,
      [lang]: items.join('\n'),
    }))
  }

  const handleAddAgendaItem = (lang) => {
    const value = String(newAgendaItem[lang] || '').trim()
    if (!value) return
    const items = parseAgendaItems(guestAgenda[lang])
    updateAgendaItems(lang, [...items, value])
    setNewAgendaItem((prev) => ({ ...prev, [lang]: '' }))
  }

  const handleRemoveAgendaItem = (lang, index) => {
    const items = parseAgendaItems(guestAgenda[lang])
    items.splice(index, 1)
    updateAgendaItems(lang, items)
  }

  const handleEditAgenda = (item) => {
    setAgendaForm({
      time_display: item.time_display || '',
      title_en: item.title_en || '',
      title_de: item.title_de || '',
      title_fr: item.title_fr || '',
      description_en: item.description_en || '',
      description_de: item.description_de || '',
      description_fr: item.description_fr || '',
      icon: item.icon || '',
    })
    setEditingAgendaId(item.id)
    setShowAgendaForm(true)
  }

  const handleSubmitAgenda = (e) => {
    e.preventDefault()
    if (editingAgendaId) {
      updateAgendaItem.mutate({ id: editingAgendaId, ...agendaForm })
    } else {
      createAgendaItem.mutate(agendaForm)
    }
  }

  useEffect(() => {
    if (!contentItems) return
    const view = contentItems.find((c) => c.key === SETTINGS_KEYS.view)?.content || ''
    const upload = contentItems.find((c) => c.key === SETTINGS_KEYS.upload)?.content || ''
    setExternalViewUrl(view)
    setExternalUploadUrl(upload)

    const readTheme = (key, fallback) => {
      const v = contentItems.find((c) => c.key === key)?.content
      return v || fallback
    }
    setTheme({
      primary: readTheme(THEME_KEYS.primary, '#EC4899'),
      secondary: readTheme(THEME_KEYS.secondary, '#7C3AED'),
      accent: readTheme(THEME_KEYS.accent, '#111827'),
      background: readTheme(THEME_KEYS.background, '#FFFFFF'),
      text: readTheme(THEME_KEYS.text, '#111827'),
    })
  }, [contentItems])

  useEffect(() => {
    if (didInitGuestCardsRef.current) return
    if (!guestPortalSettings) return
    setGuestEventId(String(guestPortalSettings.guestEventId || ''))
    setGuestEventDetails({
      en: String(guestPortalSettings.guestEventDetails?.en || ''),
      de: String(guestPortalSettings.guestEventDetails?.de || ''),
      fr: String(guestPortalSettings.guestEventDetails?.fr || ''),
    })
    setGuestTimelineVenueId(String(guestPortalSettings.guestTimelineVenueId || ''))
    setGuestAgenda({
      en: String(guestPortalSettings.guestAgenda?.en || ''),
      de: String(guestPortalSettings.guestAgenda?.de || ''),
      fr: String(guestPortalSettings.guestAgenda?.fr || ''),
    })
    setGuestDresscode({
      en: String(guestPortalSettings.guestDresscode?.en || ''),
      de: String(guestPortalSettings.guestDresscode?.de || ''),
      fr: String(guestPortalSettings.guestDresscode?.fr || ''),
    })
    setGuestAccommodationVenueId(String(guestPortalSettings.guestAccommodationVenueId || ''))
    setGuestAccommodationDetails({
      en: String(guestPortalSettings.guestAccommodationDetails?.en || ''),
      de: String(guestPortalSettings.guestAccommodationDetails?.de || ''),
      fr: String(guestPortalSettings.guestAccommodationDetails?.fr || ''),
    })
    setGuestAccommodationBookingLink(String(guestPortalSettings.guestAccommodationBookingLink || ''))
    
    // Gift Registry
    setGiftIban({
      en: String(guestPortalSettings.giftIban?.en || ''),
      de: String(guestPortalSettings.giftIban?.de || ''),
      fr: String(guestPortalSettings.giftIban?.fr || ''),
    })
    setGiftMessage({
      en: String(guestPortalSettings.giftMessage?.en || ''),
      de: String(guestPortalSettings.giftMessage?.de || ''),
      fr: String(guestPortalSettings.giftMessage?.fr || ''),
    })
    setGiftAccountHolder({
      en: String(guestPortalSettings.giftAccountHolder?.en || ''),
      de: String(guestPortalSettings.giftAccountHolder?.de || ''),
      fr: String(guestPortalSettings.giftAccountHolder?.fr || ''),
    })
    
    // Witnesses
    try {
      const w = JSON.parse(guestPortalSettings.witnesses || '[]')
      setWitnesses(Array.isArray(w) ? w : [])
    } catch {
      setWitnesses([])
    }

    // Bride & Groom cards
    try {
      const c = JSON.parse(guestPortalSettings.coupleCards || '[]')
      setCoupleCards(Array.isArray(c) ? c : [])
    } catch {
      setCoupleCards([])
    }
    
    didInitGuestCardsRef.current = true
  }, [guestPortalSettings])


  const generateGuestPortalDraft = useMutation({
    mutationFn: async () => {
      const payload = {
        guestEventId: guestEventId || '',
        coupleNames: (coupleCards || []).map((c) => c.name).filter(Boolean).join(' & '),
        existingGuestEventDetails: guestEventDetails?.en || '',
        existingDresscode: guestDresscode?.en || '',
      }
      return api.post('/events/guest-portal-ai-draft', payload).then((r) => r.data)
    },
    onSuccess: (draft) => {
      if (!draft) {
        toast.error('No AI draft returned')
        return
      }
      setGuestEventDetails({
        en: String(draft?.en?.guestEventDetails || ''),
        de: String(draft?.de?.guestEventDetails || ''),
        fr: String(draft?.fr?.guestEventDetails || ''),
      })
      setGuestAgenda({
        en: String(draft?.en?.guestAgenda || ''),
        de: String(draft?.de?.guestAgenda || ''),
        fr: String(draft?.fr?.guestAgenda || ''),
      })
      setGuestDresscode({
        en: String(draft?.en?.guestDresscode || ''),
        de: String(draft?.de?.guestDresscode || ''),
        fr: String(draft?.fr?.guestDresscode || ''),
      })
      setGuestAccommodationDetails({
        en: String(draft?.en?.guestAccommodationDetails || ''),
        de: String(draft?.de?.guestAccommodationDetails || ''),
        fr: String(draft?.fr?.guestAccommodationDetails || ''),
      })
      setGiftMessage({
        en: String(draft?.en?.giftMessage || ''),
        de: String(draft?.de?.giftMessage || ''),
        fr: String(draft?.fr?.giftMessage || ''),
      })
      const warning = draft?.meta?.warning
      if (warning) {
        toast.success(`Draft generated with fallback: ${warning}`)
      } else {
        toast.success('AI draft generated. Review and save changes.')
      }
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to generate AI draft'),
  })

  const saveGuestPortalItems = useMutation({
    mutationFn: async () => {
      await api.post('/events/guest-portal-settings', {
        guestEventId: guestEventId || '',
        guestEventDetails,
        guestTimelineVenueId: guestTimelineVenueId || '',
        guestAgenda,
        guestDresscode,
        guestAccommodationVenueId: guestAccommodationVenueId || '',
        guestAccommodationDetails,
        guestAccommodationBookingLink: guestAccommodationBookingLink || '',
        // Gift Registry
        giftIban,
        giftMessage,
        giftAccountHolder,
        // Witnesses
        witnesses: JSON.stringify(witnesses),
        // Bride & Groom cards
        coupleCards: JSON.stringify(coupleCards),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['events', 'guest-portal-settings'])
      queryClient.invalidateQueries(['content', 'public'])
      toast.success('Saved guest portal items')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to save guest portal items'),
  })

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

      {/* Theme colors */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Website colors</h2>
        <p className="text-sm text-gray-600 mb-4">
          These colors are applied to the guest website (buttons/background accents) via theme settings.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { k: 'primary', label: 'Primary' },
            { k: 'secondary', label: 'Secondary' },
            { k: 'accent', label: 'Accent' },
            { k: 'background', label: 'Background' },
            { k: 'text', label: 'Text' },
          ].map((row) => (
            <div key={row.k} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
              <input
                type="color"
                value={theme[row.k] || '#000000'}
                onChange={(e) => setTheme((p) => ({ ...p, [row.k]: e.target.value }))}
                className="h-10 w-12 rounded border border-gray-200 bg-white"
                aria-label={`${row.label} color`}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{row.label}</div>
                <input
                  type="text"
                  value={theme[row.k] || ''}
                  onChange={(e) => setTheme((p) => ({ ...p, [row.k]: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                  placeholder="#RRGGBB"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => saveWebSettings.mutate({ key: THEME_KEYS.primary, value: theme.primary || '' })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm font-medium"
            disabled={saveWebSettings.isPending}
          >
            Save primary
          </button>
          <button
            type="button"
            onClick={() => saveWebSettings.mutate({ key: THEME_KEYS.secondary, value: theme.secondary || '' })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm font-medium"
            disabled={saveWebSettings.isPending}
          >
            Save secondary
          </button>
          <button
            type="button"
            onClick={() => saveWebSettings.mutate({ key: THEME_KEYS.accent, value: theme.accent || '' })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm font-medium"
            disabled={saveWebSettings.isPending}
          >
            Save accent
          </button>
          <button
            type="button"
            onClick={() => saveWebSettings.mutate({ key: THEME_KEYS.background, value: theme.background || '' })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm font-medium"
            disabled={saveWebSettings.isPending}
          >
            Save background
          </button>
          <button
            type="button"
            onClick={() => saveWebSettings.mutate({ key: THEME_KEYS.text, value: theme.text || '' })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm font-medium"
            disabled={saveWebSettings.isPending}
          >
            Save text
          </button>
        </div>
      </div>

      {/* Guest portal items */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Guest portal items</h2>
        <p className="text-sm text-gray-600 mb-4">
          Configure the content shown on the guest page: <strong>Wedding Programme</strong> (venue, timeline, agenda, dresscode) and <strong>Accommodation & Travel</strong> (venue with map).
        </p>

        {/* Timeline / Wedding Programme Section */}
        <div className="border rounded-lg p-4 mb-6">
          <div className="font-semibold text-gray-900 mb-3 text-lg">Wedding Programme</div>
          <p className="text-sm text-gray-500 mb-4">Configure the venue, highlighted timeline entry, detailed agenda, and dresscode for the Wedding Programme section.</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
              <select
                value={guestTimelineVenueId}
                onChange={(e) => setGuestTimelineVenueId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              >
                <option value="">(none)</option>
                {venues.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">The venue where the wedding takes place.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Highlighted timeline entry</label>
            <select
              value={guestEventId}
              onChange={(e) => setGuestEventId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
            >
              <option value="">(none)</option>
              {sortedEvents.map((ev) => {
                const d = ev?.start_time ? new Date(ev.start_time) : null
                const label = d
                  ? `${ev.name} — ${d.toLocaleDateString('de-CH')} ${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`
                  : ev.name
                return (
                  <option key={ev.id} value={String(ev.id)}>
                    {label}
                  </option>
                )
              })}
            </select>
              <p className="text-xs text-gray-500 mt-1">Featured event shown prominently above the timeline.</p>
            </div>
          </div>

          {/* Detailed Agenda */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Agenda</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { lang: 'en', label: 'English', placeholder: 'e.g. 14:00 Arrival & Welcome' },
                { lang: 'de', label: 'Deutsch', placeholder: 'z.B. 14:00 Ankunft & Empfang' },
                { lang: 'fr', label: 'Français', placeholder: 'p.ex. 14:00 Arrivée & Accueil' },
              ].map((row) => (
                <div key={row.lang} className="border border-gray-200 rounded-md p-3 bg-white">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">{row.label}</label>

                  <div className="space-y-2">
                    {parseAgendaItems(guestAgenda[row.lang]).map((item, index) => (
                      <div key={`${row.lang}-${index}`} className="flex items-center gap-2">
                        <div className="flex-1 text-sm text-gray-900">{item}</div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAgendaItem(row.lang, index)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ))}

                    {parseAgendaItems(guestAgenda[row.lang]).length === 0 && (
                      <div className="text-xs text-gray-500">No agenda items yet.</div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={newAgendaItem[row.lang]}
                      onChange={(e) => setNewAgendaItem((p) => ({ ...p, [row.lang]: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                      placeholder={row.placeholder}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddAgendaItem(row.lang)}
                      className="px-3 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-black"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        {/* Timeline Agenda Items */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Agenda items (timeline list)</label>
            <button
              type="button"
              onClick={() => {
                setShowAgendaForm(true)
                setEditingAgendaId(null)
                resetAgendaForm()
              }}
              className="px-3 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-black"
            >
              Add agenda item
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            These items are shown as a timeline on the guest page. You can add, edit, or delete them.
          </p>

          {agendaLoading && <div className="text-sm text-gray-500">Loading agenda items…</div>}

          {!agendaLoading && (!agendaItems || agendaItems.length === 0) && (
            <div className="text-sm text-gray-500">No agenda items yet.</div>
          )}

          <div className="space-y-2">
            {agendaItems?.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-gray-200 rounded-md p-3 bg-white">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <span>{item.time_display || '—'}</span>
                    {item.icon && <span>{getIconEmoji(item.icon)}</span>}
                    <span>{item.title_en || item.title_de || item.title_fr || 'Untitled'}</span>
                  </div>
                  {item.description_en && (
                    <div className="text-xs text-gray-600 mt-1">{item.description_en}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditAgenda(item)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this agenda item?')) {
                        deleteAgendaItem.mutate(item.id)
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {showAgendaForm && (
            <form onSubmit={handleSubmitAgenda} className="mt-4 border border-gray-200 rounded-md p-4 bg-white space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Time</label>
                  <input
                    type="text"
                    value={agendaForm.time_display}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, time_display: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                    placeholder="e.g. 14:00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Icon</label>
                  <select
                    value={agendaForm.icon}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                  >
                    <option value="">(none)</option>
                    {['church', 'rings', 'champagne', 'utensils', 'cake', 'music', 'camera', 'heart', 'sparkles', 'car', 'hotel'].map((icon) => (
                      <option key={icon} value={icon}>
                        {getIconEmoji(icon)} {icon}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Title (EN)</label>
                  <input
                    type="text"
                    value={agendaForm.title_en}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, title_en: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                    placeholder="e.g. Ceremony"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Title (DE)</label>
                  <input
                    type="text"
                    value={agendaForm.title_de}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, title_de: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Title (FR)</label>
                  <input
                    type="text"
                    value={agendaForm.title_fr}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, title_fr: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description (EN)</label>
                  <textarea
                    rows={2}
                    value={agendaForm.description_en}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, description_en: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description (DE)</label>
                  <textarea
                    rows={2}
                    value={agendaForm.description_de}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, description_de: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description (FR)</label>
                  <textarea
                    rows={2}
                    value={agendaForm.description_fr}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, description_fr: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-black"
                  disabled={createAgendaItem.isPending || updateAgendaItem.isPending}
                >
                  {editingAgendaId ? 'Update item' : 'Create item'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAgendaForm(false)
                    setEditingAgendaId(null)
                    resetAgendaForm()
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

          {/* Dresscode */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Dresscode</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">English</label>
                <textarea
                  rows={2}
                  value={guestDresscode.en}
                  onChange={(e) => setGuestDresscode((p) => ({ ...p, en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="e.g. Cocktail attire, elegant casual"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deutsch</label>
                <textarea
                  rows={2}
                  value={guestDresscode.de}
                  onChange={(e) => setGuestDresscode((p) => ({ ...p, de: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="z.B. Cocktail-Kleidung, elegant casual"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Français</label>
                <textarea
                  rows={2}
                  value={guestDresscode.fr}
                  onChange={(e) => setGuestDresscode((p) => ({ ...p, fr: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="p.ex. Tenue cocktail, élégant décontracté"
                />
              </div>
            </div>
          </div>

          {/* Legacy event details (optional) */}
          <div className="pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Additional notes (optional)</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">English</label>
                <textarea
                  rows={3}
                  value={guestEventDetails.en}
                  onChange={(e) => setGuestEventDetails((p) => ({ ...p, en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="Any extra notes for guests…"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deutsch</label>
                <textarea
                  rows={3}
                  value={guestEventDetails.de}
                  onChange={(e) => setGuestEventDetails((p) => ({ ...p, de: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="Zusätzliche Hinweise für Gäste…"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Français</label>
                <textarea
                  rows={3}
                  value={guestEventDetails.fr}
                  onChange={(e) => setGuestEventDetails((p) => ({ ...p, fr: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="Notes supplémentaires pour les invités…"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Accommodation Section */}
        <div className="border rounded-lg p-4">
          <div className="font-semibold text-gray-900 mb-3 text-lg">Accommodation & Travel</div>
          <p className="text-sm text-gray-500 mb-4">Configure the venue and travel details. A Google Map will be automatically displayed based on the venue address.</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accommodation venue</label>
            <select
              value={guestAccommodationVenueId}
              onChange={(e) => setGuestAccommodationVenueId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
            >
              <option value="">(none)</option>
              {venues.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Guests will see the venue’s name/address/website automatically from the selected venue.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">English</label>
                <textarea
                  rows={4}
                  value={guestAccommodationDetails.en}
                  onChange={(e) => setGuestAccommodationDetails((p) => ({ ...p, en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="Accommodation details (EN)…"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deutsch</label>
                <textarea
                  rows={4}
                  value={guestAccommodationDetails.de}
                  onChange={(e) => setGuestAccommodationDetails((p) => ({ ...p, de: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="Unterkunftsdetails (DE)…"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Français</label>
                <textarea
                  rows={4}
                  value={guestAccommodationDetails.fr}
                  onChange={(e) => setGuestAccommodationDetails((p) => ({ ...p, fr: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="Détails hébergement (FR)…"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking link (optional)</label>
              <input
                type="url"
                value={guestAccommodationBookingLink}
                onChange={(e) => setGuestAccommodationBookingLink(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                placeholder="https://booking.example.com/your-code"
              />
              <p className="text-xs text-gray-500 mt-1">
                Add a booking link for guests to reserve rooms. If empty, guests will see "Stay tuned for booking information".
              </p>
            </div>
        </div>

        {/* Gift Registry Section */}
        <div className="border rounded-lg p-4 mt-6">
          <div className="font-semibold text-gray-900 mb-3 text-lg">Gift Registry</div>
          <p className="text-sm text-gray-500 mb-4">Configure the IBAN and gift message shown on the guest Gifts page.</p>

          {/* IBAN */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">IBAN</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">English</label>
                <input
                  type="text"
                  value={giftIban.en}
                  onChange={(e) => setGiftIban((p) => ({ ...p, en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="e.g. CH93 0076 2011 6238 5295 7"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deutsch</label>
                <input
                  type="text"
                  value={giftIban.de}
                  onChange={(e) => setGiftIban((p) => ({ ...p, de: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="z.B. CH93 0076 2011 6238 5295 7"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Français</label>
                <input
                  type="text"
                  value={giftIban.fr}
                  onChange={(e) => setGiftIban((p) => ({ ...p, fr: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="p.ex. CH93 0076 2011 6238 5295 7"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The same IBAN can be entered for all languages, or you can customize per language.
            </p>
          </div>

          {/* Account Holder */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder (optional)</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">English</label>
                <input
                  type="text"
                  value={giftAccountHolder.en}
                  onChange={(e) => setGiftAccountHolder((p) => ({ ...p, en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="e.g. John & Jane Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deutsch</label>
                <input
                  type="text"
                  value={giftAccountHolder.de}
                  onChange={(e) => setGiftAccountHolder((p) => ({ ...p, de: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="z.B. Max & Anna Mustermann"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Français</label>
                <input
                  type="text"
                  value={giftAccountHolder.fr}
                  onChange={(e) => setGiftAccountHolder((p) => ({ ...p, fr: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="p.ex. Jean & Marie Dupont"
                />
              </div>
            </div>
          </div>

          {/* Gift Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gift Message</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">English</label>
                <textarea
                  rows={3}
                  value={giftMessage.en}
                  onChange={(e) => setGiftMessage((p) => ({ ...p, en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="e.g. If you still want to give us something, it would be great to have something for our honeymoon."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deutsch</label>
                <textarea
                  rows={3}
                  value={giftMessage.de}
                  onChange={(e) => setGiftMessage((p) => ({ ...p, de: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="z.B. Falls ihr uns doch etwas schenken möchtet, würden wir uns über einen Beitrag für unsere Hochzeitsreise freuen."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Français</label>
                <textarea
                  rows={3}
                  value={giftMessage.fr}
                  onChange={(e) => setGiftMessage((p) => ({ ...p, fr: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  placeholder="p.ex. Si vous souhaitez nous offrir quelque chose, une contribution pour notre lune de miel serait appréciée."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bride & Groom Contact Cards Section */}
        <div className="border rounded-lg p-4 mt-6">
          <div className="font-semibold text-gray-900 mb-3 text-lg">Bride & Groom</div>
          <p className="text-sm text-gray-500 mb-4">Add contact cards for the bride and groom. Guests can view these as flippable cards with photo on front, name & phone on back.</p>

          <div className="space-y-4">
            {coupleCards.map((c, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Person {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setCoupleCards((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Photo</label>
                    {c.image ? (
                      <div className="relative">
                        <img src={c.image} alt={c.name || 'Person'} className="w-full h-36 object-cover rounded-md" />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...coupleCards]
                            updated[idx] = { ...updated[idx], image: '' }
                            setCoupleCards(updated)
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-gray-400 bg-gray-50">
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Click to upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('Image must be under 5 MB')
                              return
                            }
                            const reader = new FileReader()
                            reader.onload = (ev) => {
                              const updated = [...coupleCards]
                              updated[idx] = { ...updated[idx], image: ev.target.result }
                              setCoupleCards(updated)
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={c.name || ''}
                        onChange={(e) => {
                          const updated = [...coupleCards]
                          updated[idx] = { ...updated[idx], name: e.target.value }
                          setCoupleCards(updated)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                        placeholder="e.g. Jane Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Phone number</label>
                      <input
                        type="text"
                        value={c.phone || ''}
                        onChange={(e) => {
                          const updated = [...coupleCards]
                          updated[idx] = { ...updated[idx], phone: e.target.value }
                          setCoupleCards(updated)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                        placeholder="e.g. +41 79 123 4567"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {coupleCards.length < 2 && (
              <button
                type="button"
                onClick={() => setCoupleCards((prev) => [...prev, { name: '', phone: '', image: '' }])}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                <PlusCircle className="w-4 h-4" />
                Add person
              </button>
            )}

            {coupleCards.length === 0 && (
              <p className="text-sm text-gray-500">No cards added yet. Click &quot;Add person&quot; to create a contact card.</p>
            )}
          </div>
        </div>

        {/* Maid of Honor & Best Man Section */}
        <div className="border rounded-lg p-4 mt-6">
          <div className="font-semibold text-gray-900 mb-3 text-lg">Maid of Honor & Best Man</div>
          <p className="text-sm text-gray-500 mb-4">Add contact cards for witnesses. Guests can view these as flippable cards with photo on front, name & phone on back.</p>

          <div className="space-y-4">
            {witnesses.map((w, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Person {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setWitnesses((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Image upload */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Photo</label>
                    {w.image ? (
                      <div className="relative">
                        <img src={w.image} alt={w.name || 'Witness'} className="w-full h-36 object-cover rounded-md" />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...witnesses]
                            updated[idx] = { ...updated[idx], image: '' }
                            setWitnesses(updated)
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-gray-400 bg-gray-50">
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Click to upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('Image must be under 5 MB')
                              return
                            }
                            const reader = new FileReader()
                            reader.onload = (ev) => {
                              const updated = [...witnesses]
                              updated[idx] = { ...updated[idx], image: ev.target.result }
                              setWitnesses(updated)
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {/* Name & Phone */}
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={w.name || ''}
                        onChange={(e) => {
                          const updated = [...witnesses]
                          updated[idx] = { ...updated[idx], name: e.target.value }
                          setWitnesses(updated)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                        placeholder="e.g. Jane Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Phone number</label>
                      <input
                        type="text"
                        value={w.phone || ''}
                        onChange={(e) => {
                          const updated = [...witnesses]
                          updated[idx] = { ...updated[idx], phone: e.target.value }
                          setWitnesses(updated)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                        placeholder="e.g. +41 79 123 4567"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {witnesses.length < 6 && (
              <button
                type="button"
                onClick={() => setWitnesses((prev) => [...prev, { name: '', phone: '', image: '' }])}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                <PlusCircle className="w-4 h-4" />
                Add person
              </button>
            )}

            {witnesses.length === 0 && (
              <p className="text-sm text-gray-500">No witnesses added yet. Click "Add person" to create a contact card.</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => generateGuestPortalDraft.mutate()}
            disabled={generateGuestPortalDraft.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 border border-violet-300 text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            {generateGuestPortalDraft.isPending ? 'Generating...' : 'Generate site content (AI)'}
          </button>
          <button
            type="button"
            onClick={() => saveGuestPortalItems.mutate()}
            disabled={saveGuestPortalItems.isPending}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
          >
            {saveGuestPortalItems.isPending ? 'Saving...' : 'Save guest portal items'}
          </button>
        </div>
      </div>

      {/* Timeline Agenda Items */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Timeline Agenda Items</h2>
            <p className="text-sm text-gray-600 mt-1">
              Add individual schedule items that will be displayed as a timeline on the guest Wedding Programme page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetAgendaForm()
              setEditingAgendaId(null)
              setShowAgendaForm(true)
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <PlusCircle className="w-5 h-5" />
            Add Item
          </button>
        </div>

        {/* Agenda Form */}
        {showAgendaForm && (
          <div className="border rounded-lg p-4 mb-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-3">
              {editingAgendaId ? 'Edit Agenda Item' : 'New Agenda Item'}
            </h3>
            <form onSubmit={handleSubmitAgenda} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                  <input
                    type="text"
                    value={agendaForm.time_display}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, time_display: e.target.value }))}
                    placeholder="e.g. 14:00 or 14:00 - 15:30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon (optional)</label>
                  <select
                    value={agendaForm.icon}
                    onChange={(e) => setAgendaForm((p) => ({ ...p, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  >
                    <option value="">(none)</option>
                    <option value="church">⛪ Church/Ceremony</option>
                    <option value="rings">💍 Rings</option>
                    <option value="champagne">🥂 Champagne/Drinks</option>
                    <option value="utensils">🍽️ Dinner</option>
                    <option value="cake">🎂 Cake</option>
                    <option value="music">🎵 Music/Dance</option>
                    <option value="camera">📷 Photos</option>
                    <option value="heart">❤️ Heart</option>
                    <option value="sparkles">✨ Sparkles</option>
                    <option value="car">🚗 Transport</option>
                    <option value="hotel">🏨 Hotel</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">English</label>
                    <input
                      type="text"
                      value={agendaForm.title_en}
                      onChange={(e) => setAgendaForm((p) => ({ ...p, title_en: e.target.value }))}
                      placeholder="e.g. Ceremony"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Deutsch</label>
                    <input
                      type="text"
                      value={agendaForm.title_de}
                      onChange={(e) => setAgendaForm((p) => ({ ...p, title_de: e.target.value }))}
                      placeholder="z.B. Zeremonie"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Français</label>
                    <input
                      type="text"
                      value={agendaForm.title_fr}
                      onChange={(e) => setAgendaForm((p) => ({ ...p, title_fr: e.target.value }))}
                      placeholder="p.ex. Cérémonie"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">English</label>
                    <textarea
                      rows={2}
                      value={agendaForm.description_en}
                      onChange={(e) => setAgendaForm((p) => ({ ...p, description_en: e.target.value }))}
                      placeholder="Optional details..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Deutsch</label>
                    <textarea
                      rows={2}
                      value={agendaForm.description_de}
                      onChange={(e) => setAgendaForm((p) => ({ ...p, description_de: e.target.value }))}
                      placeholder="Optionale Details..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Français</label>
                    <textarea
                      rows={2}
                      value={agendaForm.description_fr}
                      onChange={(e) => setAgendaForm((p) => ({ ...p, description_fr: e.target.value }))}
                      placeholder="Détails optionnels..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAgendaForm(false)
                    setEditingAgendaId(null)
                    resetAgendaForm()
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAgendaItem.isPending || updateAgendaItem.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createAgendaItem.isPending || updateAgendaItem.isPending ? 'Saving...' : editingAgendaId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Agenda Items List */}
        {agendaLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : !agendaItems || agendaItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No agenda items yet. Click "Add Item" to create your first timeline entry.
          </div>
        ) : (
          <div className="space-y-2">
            {agendaItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 border rounded-lg bg-white hover:bg-gray-50"
              >
                <div className="flex-shrink-0 w-20 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold text-gray-900">{item.time_display}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {item.icon && <span className="mr-2">{getIconEmoji(item.icon)}</span>}
                    {item.title_en}
                  </div>
                  {item.description_en && (
                    <div className="text-sm text-gray-500 truncate">{item.description_en}</div>
                  )}
                </div>
                <div className="flex-shrink-0 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditAgenda(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this agenda item?')) {
                        deleteAgendaItem.mutate(item.id)
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                <option value="carousel">Carousel (Guest Page Banner)</option>
                <option value="hero">Hero (Main Couple Photo)</option>
                <option value="photo1">Photo 1 (RSVP Left)</option>
                <option value="photo2">Photo 2 (RSVP Left)</option>
                <option value="photo3">Photo 3 (RSVP Left)</option>
                <option value="info_top">Info Page Top</option>
                <option value="edit_rsvp">Edit RSVP</option>
                <option value="travel">Travel & Accommodation</option>
                <option value="gifts">Event & Gifts</option>
                <option value="moodboard">Moodboard (Admin only)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Carousel images appear on the guest page banner. Multiple images can have this position.
                All positions except "Moodboard" will also be included in the carousel.
              </p>
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
