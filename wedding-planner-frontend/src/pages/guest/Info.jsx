import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { MapPin } from 'lucide-react'
import Timeline from '../../components/Timeline'
import PhotoGallery from './PhotoGallery'
import GiftRegistry from './GiftRegistry'
import Contact from './Contact'
import { useLanguage } from '../../contexts/LanguageContext'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import RSVP from './RSVP'
import { X } from 'lucide-react'

export default function GuestInfo() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { guest } = useGuestAuth()
  const [activeTab, setActiveTab] = useState('pass')
  const [showPassModal, setShowPassModal] = useState(false)

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

  // Auto-open wizard on first visit (only once per guest)
  useEffect(() => {
    if (!profileLoaded || !inviteToken) return
    const wizardKey = `wp_wizard_shown_${inviteToken}`
    try {
      const alreadyShown = localStorage.getItem(wizardKey)
      if (!alreadyShown) {
        setShowPassModal(true)
        localStorage.setItem(wizardKey, '1')
      }
    } catch {
      // localStorage not available
    }
  }, [profileLoaded, inviteToken])

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
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 text-center lg:text-left">
                  <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>
                    {t('guestInfoChangeTitle')}
                  </div>
                  <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>
                    {t('guestInfoChangeBody')}
                  </p>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                    <button
                      type="button"
                      onClick={() => {
                        if (!inviteToken) return
                        setShowPassModal(true)
                      }}
                      className="px-6 py-3 rounded-xl font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--wp-primary), var(--wp-secondary))' }}
                      disabled={!inviteToken}
                    >
                      {t('guestInfoOpenPass')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!inviteToken) return
                        setShowPassModal(true)
                      }}
                      className="px-6 py-3 rounded-xl font-semibold bg-white border border-black/10 hover:bg-black/5"
                      style={{ color: 'var(--wp-primary)' }}
                      disabled={!inviteToken}
                    >
                      {t('editAnswers')}
                    </button>
                  </div>
                </div>

                <div className="bg-white/60 rounded-2xl border border-black/5 p-5">
                  <div className="text-sm uppercase tracking-[0.18em] mb-3 text-center lg:text-left" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>
                    {t('guestInfoCurrentAnswers')}
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('guestInfoComing')}</span>
                      <span className="font-semibold" style={{ color: 'var(--wp-primary)' }}>{getStatusLabel(guestProfile?.rsvp_status)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('guestInfoGuests')}</span>
                      <span className="font-semibold" style={{ color: 'var(--wp-primary)' }}>{guestProfile?.number_of_guests || 1}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('guestInfoOvernight')}</span>
                      <span className="font-semibold" style={{ color: 'var(--wp-primary)' }}>{guestProfile?.overnight_stay ? t('yes') : t('no')}</span>
                    </div>
                    <div className="pt-3 border-t border-black/10">
                      <div style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{t('guestInfoDietaryDetails')}</div>
                      <div className="whitespace-pre-wrap break-words mt-1" style={{ color: 'var(--wp-primary)' }}>
                        {guestProfile?.dietary_restrictions || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accommodation & Travel Tab */}
          {activeTab === 'travel' && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="text-center lg:text-left">
                  <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('guestTravelTitle')}</div>
                  <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>
                    {t('guestTravelCardSubtitle')}
                  </p>

                  <div className="mt-6 whitespace-pre-wrap break-words" style={{ color: 'var(--wp-primary)' }}>
                    {readContent('guest_accommodation_details') || t('guestAccommodationDetailsFallback')}
                  </div>
                </div>

                <div className="bg-white/60 rounded-2xl border border-black/5 p-6">
                  <div className="flex items-center justify-center lg:justify-start gap-2 font-semibold" style={{ color: 'var(--wp-primary)' }}>
                    <MapPin className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                    {t('guestAccommodationVenueTitle')}
                  </div>

                  {readContent('guest_accommodation_venue_name') ? (
                    <div className="mt-4 text-center lg:text-left">
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
                  ) : (
                    <div className="mt-4 text-center lg:text-left" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>{t('guestAccommodationDetailsFallback')}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Wedding Program Tab */}
          {activeTab === 'program' && (
            <div>
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('timelineTitle')}</div>
                <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>{t('guestGiftsScheduleTitle')}</p>
              </div>

              <div className="mt-6 space-y-4">
                {(t('guest_event_gifts_event_label') || '').trim() && (
                  <div className="bg-white/60 border border-black/5 rounded-2xl p-5 text-center lg:text-left">
                    <div className="text-sm" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>{t('guestGiftsFeaturedEvent')}</div>
                    <div className="font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('guest_event_gifts_event_label')}</div>
                  </div>
                )}
                {(t('guest_event_gifts_timeline_details') || '').trim() && (
                  <div className="bg-white/60 border border-black/5 rounded-2xl p-5 text-center lg:text-left">
                    <div className="text-sm" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>{t('guestGiftsDetailsTitle')}</div>
                    <div className="whitespace-pre-wrap break-words" style={{ color: 'var(--wp-primary)' }}>
                      {t('guest_event_gifts_timeline_details')}
                    </div>
                  </div>
                )}
                <div className="bg-white/60 rounded-2xl border border-black/5 p-6">
                  <Timeline showTitle={false} />
                </div>
              </div>
            </div>
          )}

          {/* Gifts Tab */}
          {activeTab === 'gifts' && (
            <div>
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--wp-primary)' }}>{t('guestGiftsInfoTitle')}</div>
                <p className="mt-2" style={{ color: 'var(--wp-primary)' }}>{t('guestGiftsInfoBody')}</p>
              </div>
              <div className="mt-8">
                <GiftRegistry />
              </div>
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <div>
              <PhotoGallery />
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === 'contact' && (
            <div>
              <Contact />
            </div>
          )}
        </div>
      </main>

      {/* Wedding Pass modal overlay */}
      {showPassModal && (
        <div className="fixed inset-0 z-[10000]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowPassModal(false)}
          />
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
            <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <button
                type="button"
                onClick={() => setShowPassModal(false)}
                className="absolute top-4 right-4 z-10 rounded-full bg-white/90 border border-black/10 p-2 hover:bg-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="p-4 sm:p-6">
                <RSVP token={inviteToken} embedded onClose={() => setShowPassModal(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
