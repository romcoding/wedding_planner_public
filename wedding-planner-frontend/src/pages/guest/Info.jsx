import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { MapPin, Clock, Shirt, Check, Loader, Bed } from 'lucide-react'
import Timeline from '../../components/Timeline'
import BrandedMapEmbed from '../../components/BrandedMapEmbed'
import StyledGoogleMap from '../../components/StyledGoogleMap'
import PhotoGallery from './PhotoGallery'
import GiftRegistry from './GiftRegistry'
import Contact from './Contact'
import RSVP from './RSVP'
import { useLanguage } from '../../contexts/LanguageContext'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default function GuestInfo() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const { guest } = useGuestAuth()
  const [activeTab, setActiveTab] = useState('pass')
  const [isEditing, setIsEditing] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [editForm, setEditForm] = useState({
    rsvp_status: 'pending',
    overnight_stay: false,
    dietary_restrictions: '',
    special_requests: '',
  })

  const inviteToken = useMemo(() => {
    try {
      return localStorage.getItem('guest_invite_token')
    } catch {
      return null
    }
  }, [])

  // Fetch guest profile (uses guest_token JWT)
  const { data: guestProfile, isSuccess: profileLoaded } = useQuery({
    queryKey: ['guest-profile'],
    queryFn: () => api.get('/guest-auth/profile').then((res) => res.data),
  })

  // Fetch images for carousel (all positions except moodboard)
  const { data: allImages } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  // Fetch agenda items for timeline
  const { data: agendaItems } = useQuery({
    queryKey: ['agenda'],
    queryFn: () => api.get('/agenda').then((res) => res.data),
  })

  // Get localized agenda item text
  const { language } = useLanguage()
  const getLocalizedText = (item, field) => {
    const langKey = `${field}_${language}`
    return item[langKey] || item[`${field}_en`] || item[field] || ''
  }

  // Get emoji for icon
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

  // Populate edit form when profile loads
  useEffect(() => {
    if (guestProfile) {
      setEditForm({
        rsvp_status: guestProfile.rsvp_status || 'pending',
        overnight_stay: guestProfile.overnight_stay || false,
        dietary_restrictions: guestProfile.dietary_restrictions || '',
        special_requests: guestProfile.special_requests || '',
      })
    }
  }, [guestProfile])

  // Show wizard popup for guests with pending RSVP status
  // Once they confirm or decline, they go directly to the wedding page
  useEffect(() => {
    if (!profileLoaded || !inviteToken) return
    
    // Only show wizard for pending status
    const isPending = !guestProfile?.rsvp_status || guestProfile.rsvp_status === 'pending'
    
    if (isPending) {
      setShowWizard(true)
    } else {
      setShowWizard(false)
    }
  }, [profileLoaded, guestProfile?.rsvp_status, inviteToken])

  const handleWizardClose = () => {
    // Refresh profile data after wizard closes
    queryClient.invalidateQueries(['guest-profile'])
    // The useEffect above will handle closing the wizard if RSVP status is no longer pending
  }

  // Mutation to save changes
  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/guests/update-rsvp', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['guest-profile'])
      setIsEditing(false)
    },
    onError: (err) => {
      alert(err.response?.data?.error || t('saveFailed'))
    },
  })

  const handleSaveChanges = () => {
    updateMutation.mutate({
      rsvp_status: editForm.rsvp_status,
      overnight_stay: editForm.overnight_stay,
      dietary_restrictions: editForm.dietary_restrictions,
      special_requests: editForm.special_requests,
    })
  }

  const readContent = (key) => {
    const v = t(key)
    if (!v || v === key) return ''
    return String(v)
  }

  const parseAgendaItems = (value) =>
    String(value || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

  const getStatusLabel = (status) => {
    if (status === 'confirmed') return t('yes')
    if (status === 'declined') return t('no')
    return t('pending')
  }

  // Display greeting: first names only. For couples, show both first names.
  const guestGreeting = useMemo(() => {
    // Check if there are invitee_names (for couples/groups)
    const inviteeNames = guestProfile?.invitee_names
    if (Array.isArray(inviteeNames) && inviteeNames.length > 1) {
      // Extract first names only from each invitee name
      const firstNames = inviteeNames.map((name) => {
        const parts = String(name).trim().split(/\s+/)
        return parts[0] || ''
      }).filter(Boolean)
      if (firstNames.length >= 2) {
        // Join with " & " for couples
        return firstNames.slice(0, 2).join(' & ')
      }
    }
    // Fallback: use first_name from profile or auth
    const firstName = guestProfile?.first_name || guest?.first_name || ''
    return firstName
  }, [guestProfile?.invitee_names, guestProfile?.first_name, guest?.first_name])

  // Build carousel images from API - include all positions except moodboard
  const carouselImages = useMemo(() => {
    if (!allImages || !Array.isArray(allImages)) {
      // Fallback to local images if API not loaded yet
      return [
        '/images/20240709_172842.jpg',
        '/images/36ce974e-6449-4491-a3a4-0c1741df5616.jpg',
        '/images/DSC_3034.jpeg',
      ]
    }
    // Filter out moodboard images, include all others (carousel, hero, photo1, photo2, photo3, travel, gifts, etc.)
    const carouselImgs = allImages
      .filter((img) => img.is_active && img.is_public && img.position !== 'moodboard' && img.url)
      .sort((a, b) => {
        // Prioritize 'carousel' position first, then by order
        if (a.position === 'carousel' && b.position !== 'carousel') return -1
        if (b.position === 'carousel' && a.position !== 'carousel') return 1
        return (a.order || 0) - (b.order || 0)
      })
      .map((img) => img.url)
    
    // If no images from API, fall back to local files
    if (carouselImgs.length === 0) {
      return [
        '/images/20240709_172842.jpg',
        '/images/36ce974e-6449-4491-a3a4-0c1741df5616.jpg',
        '/images/DSC_3034.jpeg',
      ]
    }
    return carouselImgs
  }, [allImages])

  // Menu items for tab navigation
  const menuItems = [
    { id: 'pass', label: t('guestNavWeddingPass') },
    { id: 'travel', label: t('guestNavTravelAccommodation') },
    { id: 'program', label: t('guestNavWeddingProgram') },
    { id: 'gifts', label: t('guestNavGifts') },
    { id: 'photos', label: t('guestNavPhotos') },
    { id: 'contact', label: t('guestNavContact') },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F3EA' }}>
      {/* Banner - eggshell white with primary color text, larger and centered */}
      <header
        className="w-full"
        style={{
          backgroundColor: '#F7F3EA',
          color: 'var(--wp-primary)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
          {/* Language switcher - top right */}
          <div className="flex justify-end mb-4">
            <LanguageSwitcher />
          </div>

          {/* Centered greeting and title */}
          <div className="text-center">
            <div className="text-lg md:text-xl tracking-wide opacity-90 mb-2">
              {t('guestNavHello')}
              {guestGreeting ? ` ${guestGreeting}` : ''}
            </div>
            <div className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight font-medium">
              {t('guestNavWeddingPass')}
            </div>
          </div>

          {/* Menu - centered tabs */}
          <nav className="mt-8 md:mt-10">
            <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 overflow-x-auto whitespace-nowrap pb-2 px-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`text-base md:text-lg font-medium tracking-wide transition-all pb-2 border-b-2 ${
                    activeTab === item.id
                      ? 'border-current opacity-100'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ color: 'var(--wp-primary)' }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* Carousel - larger images */}
      <div className="wp-marquee border-b border-black/10">
        <div
          className="wp-marquee__track"
          style={{
            // Smoothness: longer duration when more images are added later
            '--wp-marquee-duration': `${Math.max(30, carouselImages.length * 12)}s`,
          }}
        >
          {[...carouselImages, ...carouselImages].map((src, idx) => (
            <div key={`${src}-${idx}`} className="wp-marquee__item">
              <img
                src={src}
                alt=""
                className="h-56 sm:h-72 md:h-80 lg:h-96 w-[75vw] sm:w-[55vw] md:w-[42vw] lg:w-[36vw] object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tab content - only show active tab */}
      <main style={{ backgroundColor: '#F7F3EA' }}>
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
          {/* Wedding Pass Tab */}
          {activeTab === 'pass' && (
            <div className="max-w-xl mx-auto text-center">
              <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>
                {t('guestInfoChangeTitle')}
              </div>
              <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>
                {t('guestInfoChangeBody')}
              </p>

              {!isEditing ? (
                <>
                  {/* Display current answers */}
                  <div className="mt-8 space-y-4 text-left">
                    <div className="flex items-center justify-between gap-4 py-3 border-b border-black/10">
                      <span style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('guestInfoComing')}</span>
                      <span className="font-semibold" style={{ color: 'var(--wp-primary)' }}>{getStatusLabel(guestProfile?.rsvp_status)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3 border-b border-black/10">
                      <span style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('guestInfoGuests')}</span>
                      <span className="font-semibold" style={{ color: 'var(--wp-primary)' }}>{guestProfile?.number_of_guests || 1}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3 border-b border-black/10">
                      <span style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('guestInfoOvernight')}</span>
                      <span className="font-semibold" style={{ color: 'var(--wp-primary)' }}>{guestProfile?.overnight_stay ? t('yes') : t('no')}</span>
                    </div>
                    <div className="py-3 border-b border-black/10">
                      <div className="flex items-center justify-between gap-4">
                        <span style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('guestInfoDietaryDetails')}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words mt-1" style={{ color: 'var(--wp-primary)' }}>
                        {guestProfile?.dietary_restrictions || '—'}
                      </div>
                    </div>
                    <div className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <span style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('qNotes')}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words mt-1" style={{ color: 'var(--wp-primary)' }}>
                        {guestProfile?.special_requests || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 text-center">
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-6 py-3 rounded-xl font-semibold text-white"
                      style={{ backgroundColor: 'var(--wp-primary)' }}
                    >
                      {t('editAnswers')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Editable form */}
                  <div className="mt-8 space-y-6 text-left">
                    {/* Attendance Decision - First Field */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--wp-primary)' }}>
                        {t('guestInfoAttending')}
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditForm((p) => ({ ...p, rsvp_status: 'confirmed' }))}
                          className={`flex-1 px-4 py-3 rounded-xl font-semibold border transition-all ${
                            editForm.rsvp_status === 'confirmed'
                              ? 'text-white'
                              : 'bg-white border-black/10 hover:bg-black/5'
                          }`}
                          style={editForm.rsvp_status === 'confirmed' ? { backgroundColor: 'var(--wp-primary)' } : { color: 'var(--wp-primary)' }}
                        >
                          {t('yes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditForm((p) => ({ ...p, rsvp_status: 'declined' }))}
                          className={`flex-1 px-4 py-3 rounded-xl font-semibold border transition-all ${
                            editForm.rsvp_status === 'declined'
                              ? 'text-white'
                              : 'bg-white border-black/10 hover:bg-black/5'
                          }`}
                          style={editForm.rsvp_status === 'declined' ? { backgroundColor: 'var(--wp-primary)' } : { color: 'var(--wp-primary)' }}
                        >
                          {t('no')}
                        </button>
                      </div>
                    </div>

                    {/* Overnight Stay */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--wp-primary)' }}>
                        {t('guestInfoOvernight')}
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditForm((p) => ({ ...p, overnight_stay: true }))}
                          className={`flex-1 px-4 py-3 rounded-xl font-semibold border transition-all ${
                            editForm.overnight_stay
                              ? 'text-white'
                              : 'bg-white border-black/10 hover:bg-black/5'
                          }`}
                          style={editForm.overnight_stay ? { backgroundColor: 'var(--wp-primary)' } : { color: 'var(--wp-primary)' }}
                        >
                          {t('yes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditForm((p) => ({ ...p, overnight_stay: false }))}
                          className={`flex-1 px-4 py-3 rounded-xl font-semibold border transition-all ${
                            !editForm.overnight_stay
                              ? 'text-white'
                              : 'bg-white border-black/10 hover:bg-black/5'
                          }`}
                          style={!editForm.overnight_stay ? { backgroundColor: 'var(--wp-primary)' } : { color: 'var(--wp-primary)' }}
                        >
                          {t('no')}
                        </button>
                      </div>
                      {/* Booking Link Hint when overnight_stay is yes */}
                      {editForm.overnight_stay && (
                        <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--wp-primary-20)' }}>
                          {readContent('guest_accommodation_booking_link') ? (
                            <p className="text-sm" style={{ color: 'var(--wp-primary)' }}>
                              {t('bookingLinkHint')}{' '}
                              <a
                                href={readContent('guest_accommodation_booking_link')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-semibold"
                                style={{ color: 'var(--wp-primary)' }}
                              >
                                {t('bookingLinkClick')}
                              </a>
                            </p>
                          ) : (
                            <p className="text-sm" style={{ color: 'var(--wp-primary)' }}>
                              {t('bookingLinkComingSoon')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Dietary Restrictions */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--wp-primary)' }}>
                        {t('guestInfoDietaryDetails')}
                      </label>
                      <textarea
                        rows={3}
                        value={editForm.dietary_restrictions}
                        onChange={(e) => setEditForm((p) => ({ ...p, dietary_restrictions: e.target.value }))}
                        placeholder={t('dietaryPlaceholderShort')}
                        className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white"
                        style={{ color: 'var(--wp-primary)', outline: 'none' }}
                      />
                    </div>

                    {/* Special Requests / Music Wishes */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--wp-primary)' }}>
                        {t('qNotes')}
                      </label>
                      <textarea
                        rows={3}
                        value={editForm.special_requests}
                        onChange={(e) => setEditForm((p) => ({ ...p, special_requests: e.target.value }))}
                        placeholder={t('notesPlaceholder')}
                        className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white"
                        style={{ color: 'var(--wp-primary)', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      disabled={updateMutation.isPending}
                      className="px-6 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'var(--wp-primary)' }}
                    >
                      {updateMutation.isPending ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          {t('saving')}
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          {t('guestInfoSaveChanges')}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false)
                        // Reset form to current profile values
                        if (guestProfile) {
                          setEditForm({
                            rsvp_status: guestProfile.rsvp_status || 'pending',
                            overnight_stay: guestProfile.overnight_stay || false,
                            dietary_restrictions: guestProfile.dietary_restrictions || '',
                            special_requests: guestProfile.special_requests || '',
                          })
                        }
                      }}
                      className="px-6 py-3 rounded-xl font-semibold bg-white border border-black/10 hover:bg-black/5"
                      style={{ color: 'var(--wp-primary)' }}
                    >
                      {t('guestInfoCancelEditing')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Accommodation & Travel Tab */}
          {activeTab === 'travel' && (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('guestTravelTitle')}</div>
                <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>
                  {t('guestTravelCardSubtitle')}
                </p>
              </div>

              <div className="space-y-8">
                {/* Accommodation Details */}
                {(readContent('guest_accommodation_details') || '').trim() && (
                  <div className="text-center whitespace-pre-wrap break-words" style={{ color: 'var(--wp-primary)' }}>
                    {readContent('guest_accommodation_details')}
                  </div>
                )}

                {/* Venue Info */}
                {readContent('guest_accommodation_venue_name') && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 font-semibold mb-3" style={{ color: 'var(--wp-primary)' }}>
                      <MapPin className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                      {t('guestAccommodationVenueTitle')}
                    </div>
                    <div className="text-lg font-semibold" style={{ color: 'var(--wp-primary)' }}>{readContent('guest_accommodation_venue_name')}</div>
                    {readContent('guest_accommodation_venue_address') && (
                      <div style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{readContent('guest_accommodation_venue_address')}</div>
                    )}
                    {readContent('guest_accommodation_venue_city_region') && (
                      <div style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{readContent('guest_accommodation_venue_city_region')}</div>
                    )}
                    {readContent('guest_accommodation_venue_website') && (
                      <a
                        href={readContent('guest_accommodation_venue_website')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex mt-4 font-semibold hover:underline"
                        style={{ color: 'var(--wp-primary)' }}
                      >
                        {t('guestAccommodationOpenWebsite')}
                      </a>
                    )}
                  </div>
                )}

                {/* Booking Link Section */}
                <div className="text-center pt-6 border-t border-black/10">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Bed className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                    <div className="text-xl font-semibold" style={{ color: 'var(--wp-primary)' }}>
                      {t('guestAccommodationBookingTitle')}
                    </div>
                  </div>
                  {readContent('guest_accommodation_booking_link') ? (
                    <a
                      href={readContent('guest_accommodation_booking_link')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex px-6 py-3 rounded-xl font-semibold text-white"
                      style={{ backgroundColor: 'var(--wp-primary)' }}
                    >
                      {t('guestAccommodationBookNow')}
                    </a>
                  ) : (
                    <div style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>
                      {t('guestAccommodationBookingStayTuned')}
                    </div>
                  )}
                </div>

                {/* Google Maps Embed */}
                {readContent('guest_accommodation_map_address') && (
                  <div className="max-w-lg mx-auto">
                    {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                      <StyledGoogleMap
                        title={t('guestAccommodationVenueTitle')}
                        address={readContent('guest_accommodation_map_address')}
                        openUrl={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(readContent('guest_accommodation_map_address'))}`}
                        openLabel={t('openInGoogleMaps') || 'Open in Google Maps'}
                        height={260}
                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                      />
                    ) : (
                      <BrandedMapEmbed
                        title={t('guestAccommodationVenueTitle')}
                        embedSrc={`https://www.google.com/maps?q=${encodeURIComponent(readContent('guest_accommodation_map_address'))}&output=embed`}
                        openUrl={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(readContent('guest_accommodation_map_address'))}`}
                        openLabel={t('openInGoogleMaps') || 'Open in Google Maps'}
                        height={260}
                      />
                    )}
                  </div>
                )}

                {/* Fallback if no venue info */}
                {!readContent('guest_accommodation_venue_name') && !(readContent('guest_accommodation_details') || '').trim() && (
                  <div className="text-center" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>{t('guestAccommodationDetailsFallback')}</div>
                )}
              </div>
            </div>
          )}

          {/* Wedding Program Tab */}
          {activeTab === 'program' && (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('timelineTitle')}</div>
                <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>{t('guestGiftsScheduleTitle')}</p>
              </div>

              <div className="space-y-8">
                {/* Venue + Dresscode Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center">
                  {/* Venue */}
                  {readContent('guest_timeline_venue_name') && (
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <MapPin className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                        <div className="text-sm font-medium" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>{t('venueLabel') || 'Venue'}</div>
                      </div>
                      <div className="text-lg font-semibold" style={{ color: 'var(--wp-primary)' }}>
                        {readContent('guest_timeline_venue_name')}
                      </div>
                      {readContent('guest_timeline_venue_address') && (
                        <div className="mt-1" style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>
                          {readContent('guest_timeline_venue_address')}
                        </div>
                      )}
                      {readContent('guest_timeline_venue_city_region') && (
                        <div style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>
                          {readContent('guest_timeline_venue_city_region')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dresscode */}
                  {readContent('guest_dresscode') && (
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <Shirt className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                        <div className="text-sm font-medium" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>{t('dresscodeLabel') || 'Dresscode'}</div>
                      </div>
                      <div className="whitespace-pre-wrap break-words" style={{ color: 'var(--wp-primary)' }}>
                        {readContent('guest_dresscode')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline Agenda Items */}
                {agendaItems && agendaItems.length > 0 && (
                  <div className="pt-6 border-t border-black/10">
                    {/* Timeline items - centered vertical layout */}
                    <div className="max-w-sm mx-auto">
                      <div className="relative pl-8 sm:pl-10">
                        {/* Timeline line */}
                        <div 
                          className="absolute left-3 sm:left-4 top-2 bottom-2 w-0.5"
                          style={{ backgroundColor: 'var(--wp-primary)', opacity: 0.2 }}
                        />
                        
                        <div className="space-y-6">
                          {agendaItems.map((item) => (
                            <div key={item.id} className="relative">
                              {/* Timeline dot */}
                              <div 
                                className="absolute -left-5 sm:-left-6 top-1.5 w-3 h-3 rounded-full"
                                style={{ backgroundColor: 'var(--wp-primary)' }}
                              />
                              
                              {/* Content */}
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg font-bold" style={{ color: 'var(--wp-primary)' }}>
                                    {item.time_display}
                                  </span>
                                  {item.icon && (
                                    <span className="text-xl">{getIconEmoji(item.icon)}</span>
                                  )}
                                </div>
                                <div className="font-semibold" style={{ color: 'var(--wp-primary)' }}>
                                  {getLocalizedText(item, 'title')}
                                </div>
                                {getLocalizedText(item, 'description') && (
                                  <div className="text-sm mt-1" style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>
                                    {getLocalizedText(item, 'description')}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailed Agenda (fallback if no agenda items) */}
                {(!agendaItems || agendaItems.length === 0) && readContent('guest_agenda') && (
                  <div className="pt-6 border-t border-black/10 text-center">
                    <div className="whitespace-pre-wrap break-words" style={{ color: 'var(--wp-primary)' }}>
                      {readContent('guest_agenda')}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Gifts Tab */}
          {activeTab === 'gifts' && (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('guestGiftsInfoTitle')}</div>
                <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>{t('guestGiftsInfoBody')}</p>
              </div>
              <GiftRegistry />
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <div className="max-w-3xl mx-auto text-center">
              <PhotoGallery />
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === 'contact' && (
            <div className="max-w-2xl mx-auto">
              <Contact />
            </div>
          )}
        </div>
      </main>

      {/* Wizard Popup Modal for first-time guests */}
      {showWizard && inviteToken && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto">
          {/* Backdrop - no click handler, guests must complete wizard */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          
          {/* Modal Content */}
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl">
              {/* Inner content container */}
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* RSVP Wizard embedded */}
                <RSVP 
                  token={inviteToken} 
                  embedded={true} 
                  onClose={handleWizardClose}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
