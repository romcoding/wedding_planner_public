import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Calendar as CalendarIcon, MapPin, X, List, Grid, Camera } from 'lucide-react'

// Set moment locale
moment.locale('en')
const localizer = momentLocalizer(moment)

function pad2(n) {
  return String(n).padStart(2, '0')
}

// `datetime-local` expects a local time string: "YYYY-MM-DDTHH:mm"
// We store/send "naive" ISO strings (no timezone) to avoid UTC shifts in the admin UI.
function toDateTimeLocalValue(isoString) {
  if (!isoString) return ''
  const s = String(isoString).trim()

  // If the string carries timezone info, convert to local date parts.
  const hasTz = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)
  if (hasTz) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }

  // Otherwise treat as local/naive and just shape it for the input.
  const normalized = s.replace(' ', 'T')
  // fromisoformat() returns "YYYY-MM-DDTHH:mm:ss" -> trim seconds
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized
}

const EventsPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [view, setView] = useState('list') // 'list' or 'calendar'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
    end_date: '',
    order: 0,
    is_public: true,
    is_active: true,
    dress_code: '',
    notes: '',
  })

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then((res) => res.data),
  })

  // Admin content (for setting wedding date keys) - admin-only on backend.
  const { data: adminContent } = useQuery({
    queryKey: ['content', 'admin'],
    queryFn: () => api.get('/content?admin=true').then((res) => res.data),
    retry: false,
  })

  const upsertContentKey = async ({ key, title, content_en, content_de, content_fr }) => {
    const existing = adminContent?.find((c) => c.key === key)
    const payload = {
      key,
      title,
      content_type: 'text',
      is_public: true,
      content_en,
      content_de,
      content_fr,
      // keep legacy field in sync for older readers
      content: content_en,
    }
    if (existing?.id) {
      return api.put(`/content/${existing.id}`, payload).then((r) => r.data)
    }
    return api.post('/content', payload).then((r) => r.data)
  }

  const setWeddingDateFromEvent = useMutation({
    mutationFn: async (event) => {
      if (!event?.start_time) throw new Error('Event has no start date')

      const iso = moment(event.start_time).format('YYYY-MM-DD')
      // Use noon to avoid timezone edge cases when formatting
      const dateForFormat = new Date(`${iso}T12:00:00`)

      const displayEn = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(dateForFormat)
      const displayDe = new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }).format(dateForFormat)
      const displayFr = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }).format(dateForFormat)

      await upsertContentKey({
        key: 'wedding_date_iso',
        title: 'Wedding date (ISO)',
        content_en: iso,
        content_de: iso,
        content_fr: iso,
      })

      await upsertContentKey({
        key: 'wedding_date',
        title: 'Wedding date (display)',
        content_en: displayEn,
        content_de: displayDe,
        content_fr: displayFr,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['content'])
      queryClient.invalidateQueries(['content', 'public'])
      queryClient.invalidateQueries(['content', 'admin'])
      alert('Wedding date has been set from this event.')
    },
    onError: (err) => {
      console.error('Failed to set wedding date:', err)
      alert(err?.message || 'Failed to set wedding date.')
    },
  })

  // Sort events chronologically by start_time
  const sortedEvents = events ? [...events].sort((a, b) => {
    const dateA = new Date(a.start_time)
    const dateB = new Date(b.start_time)
    return dateA - dateB
  }) : []

  const [fieldErrors, setFieldErrors] = useState({})

  const createEvent = useMutation({
    mutationFn: (payload) => api.post('/events', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['events'])
      resetForm()
      setShowForm(false)
      setFieldErrors({})
      alert('Event created successfully!')
    },
    onError: (error) => {
      console.error('Error creating event:', error)
      const errorData = error.response?.data
      if (errorData?.errors) {
        // Field-specific errors
        setFieldErrors(errorData.errors)
      } else {
        setFieldErrors({ general: errorData?.error || 'Failed to create event. Please check all required fields and date formats.' })
      }
    },
  })

  const updateEvent = useMutation({
    mutationFn: ({ id, data }) => api.put(`/events/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['events'])
      resetForm()
      setShowForm(false)
      setFieldErrors({})
      alert('Event updated successfully!')
    },
    onError: (error) => {
      console.error('Error updating event:', error)
      const errorData = error.response?.data
      if (errorData?.errors) {
        setFieldErrors(errorData.errors)
      } else {
        setFieldErrors({ general: errorData?.error || 'Failed to update event.' })
      }
    },
  })

  const deleteEvent = useMutation({
    mutationFn: (id) => api.delete(`/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['events']),
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      location: '',
      start_time: '',
      end_time: '',
      end_date: '',
      order: 0,
      is_public: true,
      is_active: true,
      dress_code: '',
      notes: '',
    })
    setEditingId(null)
    setFieldErrors({})
  }

  const handleEdit = (event) => {
    setFormData({
      name: event.name,
      description: event.description || '',
      location: event.location || '',
      start_time: event.start_time ? toDateTimeLocalValue(event.start_time) : '',
      end_time: event.end_time ? toDateTimeLocalValue(event.end_time) : '',
      end_date: event.end_date || '',
      order: event.order || 0,
      is_public: event.is_public,
      is_active: event.is_active,
      dress_code: event.dress_code || '',
      notes: event.notes || '',
    })
    setEditingId(event.id)
    setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFieldErrors({})
    
    // Validate required fields
    const errors = {}
    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Event name is required'
    }
    if (!formData.start_time) {
      errors.start_time = 'Start time is required'
    }
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    
    // Keep local datetime values as-is (avoid UTC conversion / time shifting).
    let payload
    try {
      payload = {
        ...formData,
        start_time: String(formData.start_time || '').trim(),
        end_time: formData.end_time ? String(formData.end_time).trim() : null,
        end_date: formData.end_date || null,
        order: parseInt(formData.order, 10) || 0,
      }
    } catch (error) {
      setFieldErrors({ general: 'Invalid date format. Please check your date inputs.' })
      return
    }
    
    if (editingId) {
      updateEvent.mutate({ id: editingId, data: payload })
    } else {
      createEvent.mutate(payload)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  // Get event icon and color based on event name/type
  const getEventIcon = (eventName) => {
    const name = eventName.toLowerCase()
    if (name.includes('ceremony') || name.includes('wedding')) return { icon: Heart, color: 'text-red-500', bg: 'bg-red-50' }
    if (name.includes('reception') || name.includes('dinner')) return { icon: UtensilsCrossed, color: 'text-orange-500', bg: 'bg-orange-50' }
    if (name.includes('music') || name.includes('dance')) return { icon: Music, color: 'text-purple-500', bg: 'bg-purple-50' }
    if (name.includes('photo') || name.includes('picture')) return { icon: Camera, color: 'text-blue-500', bg: 'bg-blue-50' }
    if (name.includes('gift') || name.includes('registry')) return { icon: Gift, color: 'text-pink-500', bg: 'bg-pink-50' }
    return { icon: CalendarIcon, color: 'text-blue-500', bg: 'bg-blue-50' }
  }

  // Convert events to calendar format (use sortedEvents for consistency)
  const calendarEvents = sortedEvents ? sortedEvents.map(event => ({
    id: event.id,
    title: event.name,
    start: new Date(event.start_time),
    end: event.end_time ? new Date(event.end_time) : new Date(event.start_time),
    resource: event,
  })) : []

  const handleSelectEvent = (event) => {
    handleEdit(event.resource)
  }

  if (isLoading) {
    return <div className="p-6">Loading events...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Wedding Timeline</h1>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1 rounded flex items-center gap-2 font-medium ${
                view === 'list' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1 rounded flex items-center gap-2 font-medium ${
                view === 'calendar' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              <Grid className="w-4 h-4" />
              Calendar
            </button>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <PlusCircle className="w-5 h-5" />
            Add Event
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Guest page cards</h2>
        <p className="text-sm text-gray-600">
          Moved to <strong>Web page</strong> settings. Configure the accommodation card and the highlighted agenda there.
        </p>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingId ? 'Edit Event' : 'Add New Event'}
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
                {fieldErrors.general && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                    {fieldErrors.general}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                      fieldErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors.name && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time *
                    </label>
                    <input
                      type="datetime-local"
                      name="start_time"
                      value={formData.start_time}
                      onChange={handleChange}
                      step="900"
                      required
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                        fieldErrors.start_time ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {fieldErrors.start_time && (
                      <p className="text-red-600 text-sm mt-1">{fieldErrors.start_time}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Time will be rounded to nearest 15 minutes</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      name="end_time"
                      value={formData.end_time}
                      onChange={handleChange}
                      step="900"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional - time will be rounded to nearest 15 minutes</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date (for multi-day events)
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dress Code
                  </label>
                  <input
                    type="text"
                    name="dress_code"
                    value={formData.dress_code}
                    onChange={handleChange}
                    placeholder="e.g., Formal, Casual, Cocktail"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order (for sorting)
                  </label>
                  <input
                    type="number"
                    name="order"
                    value={formData.order}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_public"
                      checked={formData.is_public}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Public (visible to guests)</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    {editingId ? 'Update' : 'Create'}
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
          </div>
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="bg-white rounded-lg shadow-md p-6" style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            style={{ height: '100%' }}
            popup
            defaultDate={new Date()}
            defaultView="month"
            views={['month', 'week', 'day', 'agenda']}
            culture="en"
            messages={{
              next: 'Next',
              previous: 'Back',
              today: 'Today',
              month: 'Month',
              week: 'Week',
              day: 'Day',
              agenda: 'Agenda',
            }}
            showMultiDayTimes
            step={60}
            timeslots={1}
          />
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-4">
          {sortedEvents && sortedEvents.length > 0 ? (
            sortedEvents.map((event) => {
              const { icon: EventIcon, color, bg } = getEventIcon(event.name)
              return (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${bg}`}>
                        <EventIcon className={`w-5 h-5 ${color}`} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">{event.name}</h3>
                      {!event.is_public && (
                        <span className="text-xs bg-gray-200 text-gray-900 px-2 py-1 rounded font-medium">Private</span>
                      )}
                    </div>
                    
                    {event.description && (
                      <p className="text-gray-600 mb-3">{event.description}</p>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        <span>
                          {new Date(event.start_time).toLocaleString()}
                          {event.end_time && ` - ${new Date(event.end_time).toLocaleTimeString()}`}
                        </span>
                      </div>
                      {event.end_date && (
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          <span>Ends: {new Date(event.end_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      {event.dress_code && (
                        <div>
                          <span className="font-medium">Dress Code:</span> {event.dress_code}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setWeddingDateFromEvent.mutate(event)}
                      className="px-3 py-2 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 rounded"
                      title="Use this event as the main wedding date (updates Wedding Pass)"
                      disabled={setWeddingDateFromEvent.isPending}
                    >
                      Use as wedding date
                    </button>
                    <button
                      onClick={() => handleEdit(event)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this event?')) {
                          deleteEvent.mutate(event.id)
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              )
            })
          ) : (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
              No events yet. Click "Add Event" to create your wedding timeline.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EventsPage
