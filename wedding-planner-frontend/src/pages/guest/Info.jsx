import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { Edit, Plane, Gift, ArrowLeft, Calendar, MapPin, Music, Camera, Mail } from 'lucide-react'
import Timeline from '../../components/Timeline'
import PhotoGallery from './PhotoGallery'
import GiftRegistry from './GiftRegistry'
import Contact from './Contact'

export default function GuestInfo() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(null)
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [localEdits, setLocalEdits] = useState({
    rsvp_status: 'pending',
    overnight_stay: false,
    dietary_restrictions: '',
    special_requests: '',
    attending_names: [],
  })

  const inviteToken = useMemo(() => {
    try {
      return localStorage.getItem('guest_invite_token')
    } catch {
      return null
    }
  }, [])

  // Fetch images from API
  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  // Fetch guest profile (uses guest_token JWT)
  const { data: guestProfile } = useQuery({
    queryKey: ['guest-profile'],
    queryFn: () => api.get('/guest-auth/profile').then((res) => res.data),
  })

  useEffect(() => {
    if (!guestProfile) return
    setLocalEdits({
      rsvp_status: guestProfile.rsvp_status || 'pending',
      overnight_stay: !!guestProfile.overnight_stay,
      dietary_restrictions: guestProfile.dietary_restrictions || '',
      special_requests: guestProfile.special_requests || '',
      attending_names: Array.isArray(guestProfile.attending_names)
        ? guestProfile.attending_names
        : [],
    })
  }, [guestProfile])

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put('/guests/update-rsvp', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['guest-profile'])
      setEditMode(false)
      setActiveSection(null) // return to overview grid
    },
  })

  const getStatusLabel = (status) => {
    if (status === 'confirmed') return 'Yes'
    if (status === 'declined') return 'No'
    return 'Pending'
  }

  const getInviteTypeLabel = (n) => {
    const count = Number(n || 1)
    if (count === 1) return 'Individual'
    if (count === 2) return 'Couple'
    return 'Group'
  }

  const inviteeNames = useMemo(() => {
    const names = Array.isArray(guestProfile?.invitee_names) ? guestProfile.invitee_names : []
    const cleaned = names.map((n) => (n || '').trim()).filter(Boolean)
    if (cleaned.length) return cleaned
    const primary = `${guestProfile?.first_name || ''} ${guestProfile?.last_name || ''}`.trim()
    return primary ? [primary] : []
  }, [guestProfile?.invitee_names, guestProfile?.first_name, guestProfile?.last_name])

  const toggleAttending = (name) => {
    setLocalEdits((prev) => {
      const set = new Set(prev.attending_names || [])
      if (set.has(name)) set.delete(name)
      else set.add(name)
      return { ...prev, attending_names: Array.from(set) }
    })
  }

  // Get images by position
  const infoTopImage = images?.find(img => img.position === 'info_top' && img.is_active && img.is_public)
  const editRsvpImage = images?.find(img => img.position === 'edit_rsvp' && img.is_active && img.is_public)
  const travelImage = images?.find(img => img.position === 'travel' && img.is_active && img.is_public)
  const giftsImage = images?.find(img => img.position === 'gifts' && img.is_active && img.is_public)

  const handleSectionClick = (section) => {
    setActiveSection(section)
  }

  const handleBack = () => {
    if (activeSection) {
      setActiveSection(null)
    } else {
      navigate('/')
    }
  }

  // If a section is active, show its content
  if (activeSection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            {activeSection === 'edit_rsvp' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Edit className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">Change your information</h2>
                </div>
                <p className="text-gray-600 mb-6">
                  You can review and update your Wedding Pass at any time.
                </p>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Your current answers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">Coming</span>
                      <span className="font-semibold text-gray-900">{getStatusLabel(guestProfile?.rsvp_status)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">Invite type</span>
                      <span className="font-semibold text-gray-900">{getInviteTypeLabel(guestProfile?.number_of_guests)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">Guests</span>
                      <span className="font-semibold text-gray-900">{guestProfile?.number_of_guests || 1}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">Overnight stay</span>
                      <span className="font-semibold text-gray-900">{guestProfile?.overnight_stay ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">Dietary</span>
                      <span className="font-semibold text-gray-900">
                        {guestProfile?.dietary_restrictions ? 'Provided' : '—'}
                      </span>
                    </div>
                    <div className="md:col-span-2 bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <div className="text-gray-600 mb-1">Dietary details</div>
                      <div className="text-gray-900 whitespace-pre-wrap break-words">
                        {guestProfile?.dietary_restrictions || '—'}
                      </div>
                    </div>
                    <div className="md:col-span-2 bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <div className="text-gray-600 mb-1">Notes</div>
                      <div className="text-gray-900 whitespace-pre-wrap break-words">
                        {guestProfile?.special_requests || '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setEditMode((v) => !v)}
                    className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    {editMode ? 'Cancel editing' : 'Edit here'}
                  </button>
                  <button
                    onClick={() => {
                      if (inviteToken) {
                        navigate(`/rsvp/${inviteToken}`)
                      } else {
                        navigate('/')
                      }
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 font-medium transition-all"
                  >
                    Open your Wedding Pass
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection(null)
                      setEditMode(false)
                    }}
                    className="px-6 py-3 bg-white border border-gray-200 text-gray-900 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Back to information
                  </button>
                </div>

                {editMode && (
                  <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit your answers</h3>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Coming</label>
                      <select
                        value={localEdits.rsvp_status}
                        onChange={(e) => {
                          const next = e.target.value
                          setLocalEdits((p) => ({
                            ...p,
                            rsvp_status: next,
                            attending_names: next === 'declined' ? [] : p.attending_names,
                          }))
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                      >
                        <option value="confirmed">Yes</option>
                        <option value="declined">No</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>

                    {inviteeNames.length > 1 && (
                      <div className="mb-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">Who is coming?</div>
                        <div className="space-y-2">
                          {inviteeNames.map((name) => {
                            const checked = (localEdits.attending_names || []).includes(name)
                            return (
                              <label
                                key={name}
                                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white cursor-pointer"
                              >
                                <span className="text-gray-900 font-medium">{name}</span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={localEdits.rsvp_status !== 'confirmed'}
                                  onChange={() => toggleAttending(name)}
                                  className="w-5 h-5"
                                />
                              </label>
                            )
                          })}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Leave at least one selected if you are coming.
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Overnight stay</label>
                      <select
                        value={localEdits.overnight_stay ? 'yes' : 'no'}
                        onChange={(e) => setLocalEdits((p) => ({ ...p, overnight_stay: e.target.value === 'yes' }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dietary restrictions</label>
                      <textarea
                        rows={3}
                        value={localEdits.dietary_restrictions}
                        onChange={(e) => setLocalEdits((p) => ({ ...p, dietary_restrictions: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                      <textarea
                        rows={3}
                        value={localEdits.special_requests}
                        onChange={(e) => setLocalEdits((p) => ({ ...p, special_requests: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                      />
                    </div>

                    <button
                      onClick={() => {
                        const nextStatus = localEdits.rsvp_status
                        const payload = {
                          rsvp_status: nextStatus,
                          overnight_stay: localEdits.overnight_stay,
                          dietary_restrictions: localEdits.dietary_restrictions,
                          special_requests: localEdits.special_requests,
                        }
                        if (inviteeNames.length > 1) {
                          payload.attending_names =
                            nextStatus === 'confirmed'
                              ? (localEdits.attending_names || []).filter((n) => inviteeNames.includes(n))
                              : []
                        }
                        updateMutation.mutate(payload)
                      }}
                      disabled={updateMutation.isPending}
                      className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 font-medium transition-all disabled:opacity-50"
                    >
                      {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'travel' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Plane className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">Travel & Accommodation</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-pink-500" />
                      Venue Location
                    </h3>
                    <p className="text-gray-600">
                      The wedding will take place at a beautiful venue. Detailed directions and parking information will be sent closer to the date.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Plane className="w-5 h-5 text-pink-500" />
                      Recommended Hotels
                    </h3>
                    <p className="text-gray-600 mb-4">
                      We have reserved blocks of rooms at the following hotels:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>Hotel Option 1 - Contact: (555) 123-4567</li>
                      <li>Hotel Option 2 - Contact: (555) 234-5678</li>
                      <li>Hotel Option 3 - Contact: (555) 345-6789</li>
                    </ul>
                    <p className="text-sm text-gray-500 mt-4">
                      * Mention the wedding when booking to receive the group rate
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Transportation</h3>
                    <p className="text-gray-600">
                      Shuttle service will be provided from the recommended hotels to the venue. More details will be provided in your confirmation email.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'gifts' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Gift className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">Event & Gifts</h2>
                </div>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-pink-500" />
                      Event Schedule
                    </h3>
                    <Timeline />
                  </div>
                  <div>
                    <GiftRegistry />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'gallery' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Camera className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">Photo Gallery</h2>
                </div>
                <PhotoGallery />
              </div>
            )}

            {activeSection === 'contact' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Mail className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">Contact Us</h2>
                </div>
                <Contact />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main info page with image grid
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Top Image */}
      <div className="relative overflow-hidden">
        {infoTopImage ? (
          <div className="relative h-64 md:h-96 overflow-hidden">
            <img
              src={infoTopImage.url}
              alt={infoTopImage.alt_text || 'Wedding Information'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  Wedding Information
                </h1>
                <p className="text-xl text-white/90 drop-shadow-md">
                  Everything you need to know
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-64 md:h-96 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                Wedding Information
              </h1>
              <p className="text-xl text-white/90 drop-shadow-md">
                Everything you need to know
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Edit RSVP */}
          <div
            onClick={() => handleSectionClick('edit_rsvp')}
            className="relative h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl group"
          >
            {editRsvpImage ? (
              <img
                src={editRsvpImage.url}
                alt={editRsvpImage.alt_text || 'Change your information'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                <Edit className="w-16 h-16 text-white/80" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Edit className="w-12 h-12 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-2">Change your information</h3>
                <p className="text-white/90">Review and update your Wedding Pass</p>
              </div>
            </div>
          </div>

          {/* Travel & Accommodation */}
          <div
            onClick={() => handleSectionClick('travel')}
            className="relative h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl group"
          >
            {travelImage ? (
              <img
                src={travelImage.url}
                alt={travelImage.alt_text || 'Travel & Accommodation'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                <Plane className="w-16 h-16 text-white/80" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Plane className="w-12 h-12 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-2">Travel & Accommodation</h3>
                <p className="text-white/90">Hotels and directions</p>
              </div>
            </div>
          </div>

          {/* Event & Gifts */}
          <div
            onClick={() => handleSectionClick('gifts')}
            className="relative h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl group"
          >
            {giftsImage ? (
              <img
                src={giftsImage.url}
                alt={giftsImage.alt_text || 'Event & Gifts'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                <Gift className="w-16 h-16 text-white/80" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Gift className="w-12 h-12 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-2">Event & Gifts</h3>
                <p className="text-white/90">Schedule and registry</p>
              </div>
            </div>
          </div>

          {/* Photo Gallery */}
          <div
            onClick={() => handleSectionClick('gallery')}
            className="relative h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl group"
          >
            <div className="w-full h-full bg-gradient-to-br from-blue-200 to-purple-200 flex items-center justify-center">
              <Camera className="w-16 h-16 text-white/80" />
            </div>
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Camera className="w-12 h-12 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-2">Photo Gallery</h3>
                <p className="text-white/90">Share your photos</p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div
            onClick={() => handleSectionClick('contact')}
            className="relative h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl group"
          >
            <div className="w-full h-full bg-gradient-to-br from-green-200 to-teal-200 flex items-center justify-center">
              <Mail className="w-16 h-16 text-white/80" />
            </div>
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Mail className="w-12 h-12 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-2">Contact Us</h3>
                <p className="text-white/90">Send us a message</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="max-w-4xl mx-auto mt-12">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <Timeline />
          </div>
        </div>
      </div>
    </div>
  )
}
