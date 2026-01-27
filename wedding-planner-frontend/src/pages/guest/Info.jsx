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

export default function GuestInfo() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { guest } = useGuestAuth()
  const [activeMenu, setActiveMenu] = useState('pass')

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

  const scrollTo = (id) => {
    setActiveMenu(id)
    const el = document.getElementById(`wp-section-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const SectionShell = ({ id, title, children }) => (
    <section id={`wp-section-${id}`} className="scroll-mt-28">
      <div className="bg-white/80 backdrop-blur rounded-2xl shadow-[0_12px_40px_rgba(17,24,39,0.08)] border border-black/5 p-6 md:p-10">
        <div className="text-sm uppercase tracking-[0.18em] text-gray-500 mb-2">{title}</div>
        {children}
      </div>
    </section>
  )

  return (
    <div className="min-h-screen">
      {/* Banner */}
      <header
        className="w-full"
        style={{
          backgroundColor: 'var(--wp-primary)',
          color: 'var(--wp-secondary)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm tracking-wide opacity-90">
                {t('guestNavHello')}
                {guestName ? `, ${guestName}` : ''}
              </div>
              <div className="font-serif text-3xl md:text-4xl leading-tight">
                {t('guestNavWeddingPass')}
              </div>
            </div>

            <div className="shrink-0">
              <LanguageSwitcher />
            </div>
          </div>

          {/* Menu */}
          <nav className="mt-5 -mx-2 px-2">
            <div className="flex items-center gap-5 overflow-x-auto whitespace-nowrap pb-2">
              {[
                { id: 'pass', label: t('guestNavWeddingPass') },
                { id: 'travel', label: t('guestNavTravelAccommodation') },
                { id: 'program', label: t('guestNavWeddingProgram') },
                { id: 'gifts', label: t('guestNavGifts') },
                { id: 'photos', label: t('guestNavPhotos') },
                { id: 'contact', label: t('guestNavContact') },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className={`text-sm md:text-base font-medium tracking-wide transition-opacity ${
                    activeMenu === item.id ? 'opacity-100 underline underline-offset-8' : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* Carousel */}
      <div className="wp-marquee bg-black/5 border-b border-black/10">
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
                className="h-44 sm:h-56 md:h-64 w-[68vw] sm:w-[46vw] md:w-[34vw] object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Eggshell content */}
      <main style={{ backgroundColor: '#F7F3EA' }}>
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-10 md:space-y-14">
          <SectionShell id="pass" title={t('guestNavWeddingPass')}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="text-2xl md:text-3xl font-semibold text-gray-900">
                  {t('guestInfoChangeTitle')}
                </div>
                <p className="text-gray-700 mt-2">
                  {t('guestInfoChangeBody')}
                </p>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (inviteToken) navigate(`/rsvp/${inviteToken}`)
                      else navigate('/')
                    }}
                    className="px-6 py-3 rounded-xl font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--wp-primary), var(--wp-secondary))' }}
                  >
                    {t('guestInfoOpenPass')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/rsvp/' + (inviteToken || ''))}
                    className="px-6 py-3 rounded-xl font-semibold bg-white border border-black/10 text-gray-900 hover:bg-black/5"
                    disabled={!inviteToken}
                  >
                    {t('editAnswers')}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-black/5 p-5">
                <div className="text-sm uppercase tracking-[0.18em] text-gray-500 mb-3">
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
          </SectionShell>

          <SectionShell id="travel" title={t('guestNavTravelAccommodation')}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="text-2xl md:text-3xl font-semibold text-gray-900">{t('guestTravelTitle')}</div>
                <p className="text-gray-700 mt-2">
                  {t('guestTravelCardSubtitle')}
                </p>

                <div className="mt-6 text-gray-800 whitespace-pre-wrap break-words">
                  {readContent('guest_accommodation_details') || t('guestAccommodationDetailsFallback')}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-black/5 p-6">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                  <MapPin className="w-5 h-5" style={{ color: 'var(--wp-primary)' }} />
                  {t('guestAccommodationVenueTitle')}
                </div>

                {readContent('guest_accommodation_venue_name') ? (
                  <div className="mt-4">
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
                  <div className="mt-4 text-gray-600">{t('guestAccommodationDetailsFallback')}</div>
                )}
              </div>
            </div>
          </SectionShell>

          <SectionShell id="program" title={t('guestNavWeddingProgram')}>
            <div className="text-2xl md:text-3xl font-semibold text-gray-900">{t('timelineTitle')}</div>
            <p className="text-gray-700 mt-2">{t('guestGiftsScheduleTitle')}</p>

            <div className="mt-6 space-y-4">
              {(t('guest_event_gifts_event_label') || '').trim() && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="text-sm text-gray-600">{t('guestGiftsFeaturedEvent')}</div>
                  <div className="text-gray-900 font-semibold">{t('guest_event_gifts_event_label')}</div>
                </div>
              )}
              {(t('guest_event_gifts_timeline_details') || '').trim() && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
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
          </SectionShell>

          <SectionShell id="gifts" title={t('guestNavGifts')}>
            <div className="text-2xl md:text-3xl font-semibold text-gray-900">{t('guestGiftsInfoTitle')}</div>
            <p className="text-gray-700 mt-2">{t('guestGiftsInfoBody')}</p>
            <div className="mt-8">
              <GiftRegistry />
            </div>
          </SectionShell>

          <SectionShell id="photos" title={t('guestNavPhotos')}>
            <PhotoGallery />
          </SectionShell>

          <SectionShell id="contact" title={t('guestNavContact')}>
            <Contact />
          </SectionShell>

          <footer className="text-center text-sm text-gray-600 pt-6">
            <button
              type="button"
              onClick={() => scrollTo('pass')}
              className="font-semibold hover:underline"
              style={{ color: 'var(--wp-secondary)' }}
            >
              {t('guestNavWeddingPass')}
            </button>
          </footer>
        </div>
      </main>
    </div>
  )
}
