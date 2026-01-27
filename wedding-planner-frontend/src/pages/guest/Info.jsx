import { useMemo, useState } from 'react'
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
  const { data: guestProfile } = useQuery({
    queryKey: ['guest-profile'],
    queryFn: () => api.get('/guest-auth/profile').then((res) => res.data),
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

  const guestName = useMemo(() => {
    const fromProfile = `${guestProfile?.first_name || ''} ${guestProfile?.last_name || ''}`.trim()
    const fromAuth = `${guest?.first_name || ''} ${guest?.last_name || ''}`.trim()
    return fromProfile || fromAuth || ''
  }, [guestProfile?.first_name, guestProfile?.last_name, guest?.first_name, guest?.last_name])

  const carouselImages = useMemo(() => {
    const files = [
      '/images/20240709_172842.jpg',
      '/images/36ce974e-6449-4491-a3a4-0c1741df5616.jpg',
      '/images/DSC_3034.jpeg',
      // NOTE: HEIC files are not reliably supported in browsers; excluded intentionally.
    ]
    return files
  }, [])

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
              {guestName ? `, ${guestName}` : ''}
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
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-[0_12px_40px_rgba(17,24,39,0.08)] border border-black/5 p-6 md:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 text-center lg:text-left">
                  <div className="text-2xl md:text-3xl font-semibold text-gray-900">
                    {t('guestInfoChangeTitle')}
                  </div>
                  <p className="text-gray-700 mt-2">
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
                      className="px-6 py-3 rounded-xl font-semibold bg-white border border-black/10 text-gray-900 hover:bg-black/5"
                      disabled={!inviteToken}
                    >
                      {t('editAnswers')}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-black/5 p-5">
                  <div className="text-sm uppercase tracking-[0.18em] text-gray-500 mb-3 text-center lg:text-left">
                    {t('guestInfoCurrentAnswers')}
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-600">{t('guestInfoComing')}</span>
                      <span className="font-semibold text-gray-900">{getStatusLabel(guestProfile?.rsvp_status)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-600">{t('guestInfoGuests')}</span>
                      <span className="font-semibold text-gray-900">{guestProfile?.number_of_guests || 1}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-600">{t('guestInfoOvernight')}</span>
                      <span className="font-semibold text-gray-900">{guestProfile?.overnight_stay ? t('yes') : t('no')}</span>
                    </div>
                    <div className="pt-3 border-t border-black/10">
                      <div className="text-gray-600">{t('guestInfoDietaryDetails')}</div>
                      <div className="text-gray-900 whitespace-pre-wrap break-words mt-1">
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
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-[0_12px_40px_rgba(17,24,39,0.08)] border border-black/5 p-6 md:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="text-center lg:text-left">
                  <div className="text-2xl md:text-3xl font-semibold text-gray-900">{t('guestTravelTitle')}</div>
                  <p className="text-gray-700 mt-2">
                    {t('guestTravelCardSubtitle')}
                  </p>

                  <div className="mt-6 text-gray-800 whitespace-pre-wrap break-words">
                    {readContent('guest_accommodation_details') || t('guestAccommodationDetailsFallback')}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-black/5 p-6">
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-gray-900 font-semibold">
                    <MapPin className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                    {t('guestAccommodationVenueTitle')}
                  </div>

                  {readContent('guest_accommodation_venue_name') ? (
                    <div className="mt-4 text-center lg:text-left">
                      <div className="text-lg font-semibold text-gray-900">{readContent('guest_accommodation_venue_name')}</div>
                      {readContent('guest_accommodation_venue_address') && (
                        <div className="text-gray-700">{readContent('guest_accommodation_venue_address')}</div>
                      )}
                      {readContent('guest_accommodation_venue_city_region') && (
                        <div className="text-gray-700">{readContent('guest_accommodation_venue_city_region')}</div>
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
                    <div className="mt-4 text-gray-600 text-center lg:text-left">{t('guestAccommodationDetailsFallback')}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Wedding Program Tab */}
          {activeTab === 'program' && (
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-[0_12px_40px_rgba(17,24,39,0.08)] border border-black/5 p-6 md:p-10">
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-semibold text-gray-900">{t('timelineTitle')}</div>
                <p className="text-gray-700 mt-2">{t('guestGiftsScheduleTitle')}</p>
              </div>

              <div className="mt-6 space-y-4">
                {(t('guest_event_gifts_event_label') || '').trim() && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center lg:text-left">
                    <div className="text-sm text-gray-600">{t('guestGiftsFeaturedEvent')}</div>
                    <div className="text-gray-900 font-semibold">{t('guest_event_gifts_event_label')}</div>
                  </div>
                )}
                {(t('guest_event_gifts_timeline_details') || '').trim() && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center lg:text-left">
                    <div className="text-sm text-gray-600">{t('guestGiftsDetailsTitle')}</div>
                    <div className="text-gray-900 whitespace-pre-wrap break-words">
                      {t('guest_event_gifts_timeline_details')}
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-black/5 p-6">
                  <Timeline showTitle={false} />
                </div>
              </div>
            </div>
          )}

          {/* Gifts Tab */}
          {activeTab === 'gifts' && (
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-[0_12px_40px_rgba(17,24,39,0.08)] border border-black/5 p-6 md:p-10">
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-semibold text-gray-900">{t('guestGiftsInfoTitle')}</div>
                <p className="text-gray-700 mt-2">{t('guestGiftsInfoBody')}</p>
              </div>
              <div className="mt-8">
                <GiftRegistry />
              </div>
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-[0_12px_40px_rgba(17,24,39,0.08)] border border-black/5 p-6 md:p-10">
              <PhotoGallery />
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === 'contact' && (
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-[0_12px_40px_rgba(17,24,39,0.08)] border border-black/5 p-6 md:p-10">
              <Contact />
            </div>
          )}

          {/* Footer navigation */}
          <footer className="text-center text-sm text-gray-600 pt-8">
            <button
              type="button"
              onClick={() => setActiveTab('pass')}
              className="font-semibold hover:underline"
              style={{ color: 'var(--wp-primary)' }}
            >
              {t('guestNavWeddingPass')}
            </button>
          </footer>
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
