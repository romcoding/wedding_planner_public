import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { MapPin, Clock, Shirt, Check, Loader, Bed, Copy, Info, Car, TrainFront, Plane, Flag, Theater, Mountain, UtensilsCrossed } from 'lucide-react'
import DOMPurify from 'dompurify'
import Timeline from '../../components/Timeline'
import BrandedMapEmbed from '../../components/BrandedMapEmbed'
import StyledGoogleMap from '../../components/StyledGoogleMap'
import StyledTitle from '../../components/StyledTitle'
import PhotoGallery from './PhotoGallery'
import GiftRegistry from './GiftRegistry'
import Contact from './Contact'
import RSVP from './RSVP'
import { useLanguage } from '../../contexts/LanguageContext'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { getAgendaIcon } from '../admin/ImagesPage'
import HeartLoader from '../../components/HeartLoader'

export default function GuestInfo() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const { guest } = useGuestAuth()
  const [activeTab, setActiveTab] = useState('pass')
  const [isEditing, setIsEditing] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [ibanCopied, setIbanCopied] = useState(false)
  const [travelMode, setTravelMode] = useState('car')
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [imagesPreloaded, setImagesPreloaded] = useState(false)
  const [editForm, setEditForm] = useState({
    rsvp_status: 'pending',
    overnight_stay: false,
    dietary_restrictions: '',
    special_requests: '',
  })

  const MoodDot = ({ color }) => (
    <span
      className="inline-block w-5 h-5 rounded-full border border-black/10"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )

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
  const { data: allImages, isFetched: imagesFetched } = useQuery({
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

  // Strip HTML tags for plain text display (e.g., IBAN)
  const stripHtml = (html) => {
    if (!html) return ''
    return html.replace(/<[^>]*>/g, '').trim()
  }

  // Copy IBAN to clipboard
  const copyIbanToClipboard = async (iban) => {
    try {
      await navigator.clipboard.writeText(iban)
      setIbanCopied(true)
      setTimeout(() => setIbanCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = iban
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setIbanCopied(true)
      setTimeout(() => setIbanCopied(false), 2000)
    }
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

  // Build carousel images from API only (admin Images page) - no fallback to repo images
  const carouselImages = useMemo(() => {
    if (!allImages || !Array.isArray(allImages)) return []
    const carouselImgs = allImages
      .filter((img) => img.is_active && img.is_public && img.position !== 'moodboard' && img.url)
      .sort((a, b) => {
        if (a.position === 'carousel' && b.position !== 'carousel') return -1
        if (b.position === 'carousel' && a.position !== 'carousel') return 1
        return (a.order || 0) - (b.order || 0)
      })
      .map((img) => img.url)
    return carouselImgs
  }, [allImages])

  // Preload carousel images for smooth loading experience
  useEffect(() => {
    // Wait until the images query has completed
    if (!imagesFetched) return
    
    // If no images to preload, mark as done
    if (!carouselImages.length) {
      setImagesPreloaded(true)
      return
    }
    
    let loadedCount = 0
    const totalImages = carouselImages.length
    
    carouselImages.forEach((src) => {
      const img = new Image()
      img.onload = img.onerror = () => {
        loadedCount++
        if (loadedCount >= Math.min(5, totalImages)) {
          setImagesPreloaded(true)
        }
      }
      img.src = src
    })
  }, [carouselImages, imagesFetched])

  // Hide loading screen when profile and images are ready
  useEffect(() => {
    if (profileLoaded && imagesPreloaded) {
      // Give a moment for rendering after images are cached
      const timer = setTimeout(() => {
        setIsPageLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [profileLoaded, imagesPreloaded])

  // Menu items for tab navigation
  const menuItems = [
    { id: 'pass', label: t('guestNavWeddingPass') },
    { id: 'program', label: t('guestNavWeddingProgram') },
    { id: 'travel', label: t('guestNavTravelAccommodation') },
    { id: 'gifts', label: t('guestNavGifts') },
    { id: 'photos', label: t('guestNavPhotos') },
    { id: 'contact', label: t('guestNavContact') },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F3EA' }}>
      {/* Loading Screen */}
      <HeartLoader isLoading={isPageLoading} />

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
              <StyledTitle text={t('guestNavWeddingPass')} />
            </div>
          </div>

          {/* Menu - centered tabs */}
          <nav className="mt-8 md:mt-10">
            <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 overflow-x-auto whitespace-nowrap pb-2 px-2">
              {menuItems.map((item) => {
                const isDisabled = item.id === 'photos'
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => !isDisabled && setActiveTab(item.id)}
                    className={`text-base md:text-lg font-medium tracking-wide transition-all pb-2 border-b-2 ${
                      isDisabled
                        ? 'border-transparent opacity-40 cursor-default'
                        : activeTab === item.id
                          ? 'border-current opacity-100'
                          : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ color: 'var(--wp-primary)' }}
                  >
                    {item.label}{isDisabled ? ` (${t('comingSoon')})` : ''}
                  </button>
                )
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* Carousel - images from admin Images page only (no repo fallback) */}
      {carouselImages.length > 0 && (
        <div className="wp-marquee border-b border-black/10">
          <div
            className="wp-marquee__track"
            style={{
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
      )}

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
                <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('guestNavTravelAccommodation')}</div>
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

                {/* Travel Directions Section */}
                <div className="pt-6 border-t border-black/10">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Car className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                    <div className="text-xl font-semibold" style={{ color: 'var(--wp-primary)' }}>
                      {t('travelSectionTitle')}
                    </div>
                  </div>

                  {/* Car / Public Transport Toggle */}
                  <div className="flex justify-center gap-3 mb-6">
                    <button
                      onClick={() => setTravelMode('car')}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                      style={travelMode === 'car'
                        ? { backgroundColor: 'var(--wp-primary)', color: '#fff' }
                        : { border: '1.5px solid var(--wp-primary)', color: 'var(--wp-primary)', background: 'transparent' }
                      }
                    >
                      <Car className="w-4 h-4" />
                      {t('travelByCar')}
                    </button>
                    <button
                      onClick={() => setTravelMode('public')}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                      style={travelMode === 'public'
                        ? { backgroundColor: 'var(--wp-primary)', color: '#fff' }
                        : { border: '1.5px solid var(--wp-primary)', color: 'var(--wp-primary)', background: 'transparent' }
                      }
                    >
                      <TrainFront className="w-4 h-4" />
                      {t('travelByPublicTransport')}
                    </button>
                  </div>

                  {/* Car Directions */}
                  {travelMode === 'car' && (
                    <div className="text-center space-y-4" style={{ color: 'var(--wp-primary)' }}>
                      <p className="leading-relaxed">{t('travelCarDirections')}</p>
                      <div className="whitespace-pre-line text-sm" style={{ opacity: 0.85 }}>
                        {t('travelCarTimes')}
                      </div>
                      <div className="pt-4 border-t border-black/5">
                        <div className="text-sm font-semibold mb-1">{t('travelCarParkingTitle')}</div>
                        <div className="whitespace-pre-line text-sm" style={{ opacity: 0.85 }}>
                          {t('travelCarParking')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Public Transport Directions */}
                  {travelMode === 'public' && (
                    <div className="text-center" style={{ color: 'var(--wp-primary)' }}>
                      <p className="leading-relaxed">{t('travelPublicTransportDirections')}</p>
                    </div>
                  )}
                </div>

                {/* Google Maps Embed */}
                {readContent('guest_accommodation_map_address') && (
                  <div className="max-w-2xl mx-auto">
                    {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                      <StyledGoogleMap
                        title={t('guestAccommodationVenueTitle')}
                        address={readContent('guest_accommodation_map_address')}
                        openUrl={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(readContent('guest_accommodation_map_address'))}`}
                        openLabel={t('openInGoogleMaps') || 'Open in Google Maps'}
                        height={360}
                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                      />
                    ) : (
                      <BrandedMapEmbed
                        title={t('guestAccommodationVenueTitle')}
                        embedSrc={`https://www.google.com/maps?q=${encodeURIComponent(readContent('guest_accommodation_map_address'))}&output=embed`}
                        openUrl={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(readContent('guest_accommodation_map_address'))}`}
                        openLabel={t('openInGoogleMaps') || 'Open in Google Maps'}
                        height={360}
                      />
                    )}
                  </div>
                )}

                {/* Travel Note Callout */}
                <div
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--wp-primary) 6%, white)',
                    border: '1px solid color-mix(in srgb, var(--wp-primary) 18%, white)',
                  }}
                >
                  <Info className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--wp-primary)', opacity: 0.7 }} />
                  <div>
                    <div className="text-sm font-semibold mb-1" style={{ color: 'var(--wp-primary)' }}>
                      {t('travelNoteTitle')}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--wp-primary)', opacity: 0.85 }}>
                      {t('travelNoteBody')}
                    </p>
                    <a
                      href="https://hallwilerseelauf.ch/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-sm hover:underline"
                      style={{ color: 'var(--wp-primary)', opacity: 0.7 }}
                    >
                      {t('travelNoteLink')} &rarr;
                    </a>
                  </div>
                </div>

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
                <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('guestNavWeddingProgram')}</div>
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
                      {/* Mood color dots */}
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <MoodDot color="var(--wp-primary)" />
                        <MoodDot color="var(--wp-accent)" />
                        <MoodDot color='#5b779f' />
                        <MoodDot color='#bddaba' />
                        <MoodDot color="var(--wp-secondary)" />
                        <MoodDot color='#cb684a' />
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline Agenda Items */}
                {agendaItems && agendaItems.length > 0 && (
                  <div className="pt-6 border-t border-black/10">
                    {/* Small Agenda title with clock icon */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Clock className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                      <div className="text-sm font-medium"
                           style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>
                        {t('agendaLabel')}
                      </div>
                    </div>
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
                                <div className="flex items-center gap-2.5 mb-1">
                                  <span className="text-lg font-bold" style={{ color: 'var(--wp-primary)' }}>
                                    {item.time_display}
                                  </span>
                                  {item.icon && (
                                    <span className="flex items-center">
                                      {getAgendaIcon(item.icon)}
                                    </span>
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
                {readContent('guest_gift_message') && (
                  <div 
                    className="mt-4 text-lg prose prose-lg max-w-none" 
                    style={{ color: 'var(--wp-primary)' }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(readContent('guest_gift_message')) }}
                  />
                )}
                {!readContent('guest_gift_message') && (
                  <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>{t('guestGiftsInfoBody')}</p>
                )}
              </div>

              {/* Activity Wishlist */}
              <div className="mb-8">
                <div className="text-lg font-semibold mb-5 text-center" style={{ color: 'var(--wp-primary)' }}>
                  {t('giftWishlistTitle')}
                </div>
                <div className="flex flex-wrap justify-center gap-5 md:gap-8">
                  {[
                    { icon: Plane, label: t('activitySkydiving') },
                    { icon: Flag, label: t('activityGolf') },
                    { icon: Theater, label: t('activityTheater') },
                    { icon: Mountain, label: t('activityHiking') },
                    { icon: UtensilsCrossed, label: t('activityDining') },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--wp-primary) 10%, white)',
                          color: 'var(--wp-primary)',
                        }}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* IBAN Section */}
              {stripHtml(readContent('guest_gift_iban')) && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 mb-8 text-center shadow-sm border border-black/5">
                  <div className="text-sm uppercase tracking-wider mb-2" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>
                    {t('giftIbanLabel') || 'Bank Transfer'}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-lg font-mono font-semibold" style={{ color: 'var(--wp-primary)' }}>
                      {stripHtml(readContent('guest_gift_iban'))}
                    </div>
                    <button
                      onClick={() => copyIbanToClipboard(stripHtml(readContent('guest_gift_iban')))}
                      className="p-2 rounded-lg transition-all hover:bg-black/5"
                      style={{ color: 'var(--wp-primary)' }}
                      title={ibanCopied ? (t('copied') || 'Copied!') : (t('copyToClipboard') || 'Copy to clipboard')}
                    >
                      {ibanCopied ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {stripHtml(readContent('guest_gift_account_holder')) && (
                    <div className="mt-2 text-sm" style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>
                      {stripHtml(readContent('guest_gift_account_holder'))}
                    </div>
                  )}
                </div>
              )}

              <GiftRegistry hideEmptyState={!!stripHtml(readContent('guest_gift_iban')) || !!readContent('guest_gift_message')} />
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
