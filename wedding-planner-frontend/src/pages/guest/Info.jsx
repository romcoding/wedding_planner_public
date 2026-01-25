import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { Edit, Plane, Gift, ArrowLeft, Calendar, MapPin, Music, Camera, Mail } from 'lucide-react'
import Timeline from '../../components/Timeline'
import PhotoGallery from './PhotoGallery'
import GiftRegistry from './GiftRegistry'
import Contact from './Contact'
import { useLanguage } from '../../contexts/LanguageContext'

export default function GuestInfo() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(null)
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const { t } = useLanguage()
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

  const readContent = (key) => {
    const v = t(key)
    if (!v || v === key) return ''
    return String(v)
  }

  const getStatusLabel = (status) => {
    if (status === 'confirmed') return t('yes')
    if (status === 'declined') return t('no')
    return t('pending')
  }

  const getInviteTypeLabel = (n) => {
    const count = Number(n || 1)
    if (count === 1) return t('inviteTypeIndividual')
    if (count === 2) return t('inviteTypeCouple')
    return t('inviteTypeGroup')
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
            {t('back')}
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            {activeSection === 'edit_rsvp' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Edit className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">{t('guestInfoChangeTitle')}</h2>
                </div>
                <p className="text-gray-600 mb-6">
                  {t('guestInfoChangeBody')}
                </p>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('guestInfoCurrentAnswers')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">{t('guestInfoComing')}</span>
                      <span className="font-semibold text-gray-900">{getStatusLabel(guestProfile?.rsvp_status)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">{t('guestInfoInviteType')}</span>
                      <span className="font-semibold text-gray-900">{getInviteTypeLabel(guestProfile?.number_of_guests)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">{t('guestInfoGuests')}</span>
                      <span className="font-semibold text-gray-900">{guestProfile?.number_of_guests || 1}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">{t('guestInfoOvernight')}</span>
                      <span className="font-semibold text-gray-900">{guestProfile?.overnight_stay ? t('yes') : t('no')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <span className="text-gray-600">{t('guestInfoDietary')}</span>
                      <span className="font-semibold text-gray-900">
                        {guestProfile?.dietary_restrictions ? t('guestInfoProvided') : '—'}
                      </span>
                    </div>
                    <div className="md:col-span-2 bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <div className="text-gray-600 mb-1">{t('guestInfoDietaryDetails')}</div>
                      <div className="text-gray-900 whitespace-pre-wrap break-words">
                        {guestProfile?.dietary_restrictions || '—'}
                      </div>
                    </div>
                    <div className="md:col-span-2 bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <div className="text-gray-600 mb-1">{t('guestInfoNotes')}</div>
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
                    {editMode ? t('guestInfoCancelEditing') : t('guestInfoEditHere')}
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
                    {t('guestInfoOpenPass')}
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection(null)
                      setEditMode(false)
                    }}
                    className="px-6 py-3 bg-white border border-gray-200 text-gray-900 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    {t('guestInfoBackToInfo')}
                  </button>
                </div>

                {editMode && (
                  <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('guestInfoEditAnswers')}</h3>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestInfoComing')}</label>
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
                        <option value="confirmed">{t('yes')}</option>
                        <option value="declined">{t('no')}</option>
                        <option value="pending">{t('pending')}</option>
                      </select>
                    </div>

                    {inviteeNames.length > 1 && (
                      <div className="mb-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">{t('guestInfoWhoIsComing')}</div>
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
                          {t('guestInfoWhoIsComingHint')}
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestInfoOvernight')}</label>
                      <select
                        value={localEdits.overnight_stay ? 'yes' : 'no'}
                        onChange={(e) => setLocalEdits((p) => ({ ...p, overnight_stay: e.target.value === 'yes' }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                      >
                        <option value="no">{t('no')}</option>
                        <option value="yes">{t('yes')}</option>
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestInfoDietaryRestrictions')}</label>
                      <textarea
                        rows={3}
                        value={localEdits.dietary_restrictions}
                        onChange={(e) => setLocalEdits((p) => ({ ...p, dietary_restrictions: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestInfoNotes')}</label>
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
                      {updateMutation.isPending ? t('saving') : t('guestInfoSaveChanges')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'travel' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Plane className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">{t('guestTravelTitle')}</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-pink-500" />
                      {t('guestAccommodationVenueTitle')}
                    </h3>
                    <div className="text-gray-600 whitespace-pre-wrap break-words">
                      {readContent('guest_accommodation_details') || t('guestAccommodationDetailsFallback')}
                    </div>
                  </div>
                  {readContent('guest_accommodation_venue_name') && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                      <div className="text-lg font-semibold text-gray-900">{readContent('guest_accommodation_venue_name')}</div>
                      {readContent('guest_accommodation_venue_address') && (
                        <div className="text-gray-600">{readContent('guest_accommodation_venue_address')}</div>
                      )}
                      {readContent('guest_accommodation_venue_city_region') && (
                        <div className="text-gray-600">{readContent('guest_accommodation_venue_city_region')}</div>
                      )}
                      {readContent('guest_accommodation_venue_website') && (
                        <a
                          href={readContent('guest_accommodation_venue_website')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex mt-3 text-pink-600 hover:underline"
                        >
                          {t('guestAccommodationOpenWebsite')}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'gifts' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Gift className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">{t('guestGiftsTitle')}</h2>
                </div>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-pink-500" />
                      {t('guestGiftsScheduleTitle')}
                    </h3>
                    {readContent('guest_event_gifts_event_label') && (
                      <div className="mb-4 bg-white border border-gray-200 rounded-2xl p-5">
                        <div className="text-sm text-gray-600">{t('guestGiftsFeaturedEvent')}</div>
                        <div className="text-gray-900 font-semibold">{readContent('guest_event_gifts_event_label')}</div>
                      </div>
                    )}
                    {readContent('guest_event_gifts_timeline_details') && (
                      <div className="mb-4 bg-white border border-gray-200 rounded-2xl p-5">
                        <div className="text-sm text-gray-600">{t('guestGiftsDetailsTitle')}</div>
                        <div className="text-gray-900 whitespace-pre-wrap break-words">
                          {readContent('guest_event_gifts_timeline_details')}
                        </div>
                      </div>
                    )}
                    <Timeline showTitle={false} />
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
                  <h2 className="text-3xl font-bold text-gray-900">{t('guestGalleryTitle')}</h2>
                </div>
                <PhotoGallery />
              </div>
            )}

            {activeSection === 'contact' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Mail className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">{t('guestContactTitle')}</h2>
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
                  {t('guestInfoTitle')}
                </h1>
                <p className="text-xl text-white/90 drop-shadow-md">
                  {t('guestInfoSubtitle')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-64 md:h-96 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                {t('guestInfoTitle')}
              </h1>
              <p className="text-xl text-white/90 drop-shadow-md">
                {t('guestInfoSubtitle')}
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
                <h3 className="text-2xl font-bold mb-2">{t('guestInfoChangeTitle')}</h3>
                <p className="text-white/90">{t('guestInfoChangeCardSubtitle')}</p>
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
                <h3 className="text-2xl font-bold mb-2">{t('guestTravelTitle')}</h3>
                <p className="text-white/90">{t('guestTravelCardSubtitle')}</p>
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
                <h3 className="text-2xl font-bold mb-2">{t('guestGiftsTitle')}</h3>
                <p className="text-white/90">{t('guestGiftsCardSubtitle')}</p>
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
                <h3 className="text-2xl font-bold mb-2">{t('guestGalleryTitle')}</h3>
                <p className="text-white/90">{t('guestGalleryCardSubtitle')}</p>
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
                <h3 className="text-2xl font-bold mb-2">{t('guestContactTitle')}</h3>
                <p className="text-white/90">{t('guestContactCardSubtitle')}</p>
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
