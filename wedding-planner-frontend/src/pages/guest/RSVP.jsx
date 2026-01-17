import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CalendarPlus,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader,
  MapPin,
  NotebookPen,
} from 'lucide-react'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import GlitterAnimation from '../../components/GlitterAnimation'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import Timeline from '../../components/Timeline'
import api from '../../lib/api'

function PassCard({ children }) {
  return <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">{children}</div>
}

function PrimaryButton({ children, onClick, disabled, variant = 'primary', className = '' }) {
  const base =
    'w-full py-4 px-5 rounded-xl font-semibold text-lg transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700'
      : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

function StepShell({ title, subtitle, children }) {
  return (
    <div className="transition-opacity duration-300">
      <div className="mb-5">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h2>
        {subtitle ? <p className="text-gray-600 mt-2">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}

function TopTabs({ tabs, activeTab, setActiveTab, comingSoonLabel }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        const isDisabled = tab.disabled
        return (
          <button
            key={tab.key}
            type="button"
            disabled={isDisabled}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-colors',
              isActive
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50',
              isDisabled ? 'opacity-40 cursor-not-allowed hover:bg-white' : '',
            ].join(' ')}
            title={isDisabled ? comingSoonLabel : ''}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function PostContent({
  t,
  TimelineComponent,
  activeTab,
  setActiveTab,
  MapPinIcon,
  NotebookPenIcon,
}) {
  const tabs = [
    { key: 'needToKnow', label: t('tabNeedToKnow'), disabled: false },
    { key: 'venue', label: t('tabVenue'), disabled: true },
    { key: 'day', label: t('tabDayItself'), disabled: false },
    { key: 'evening', label: t('tabYourEvening'), disabled: true },
  ]

  return (
    <div className="mt-6">
      <TopTabs
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        comingSoonLabel={t('comingSoon')}
      />
      <div className="mt-4">
        {activeTab === 'needToKnow' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-2">
                <MapPinIcon className="w-5 h-5 text-pink-500" />
                <h3 className="text-lg font-semibold text-gray-900">{t('needToKnowTitle')}</h3>
              </div>
              <p className="text-gray-600">{t('needToKnowBody')}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-2">
                <NotebookPenIcon className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">{t('giftDressCodeTitle')}</h3>
              </div>
              <p className="text-gray-600">{t('giftDressCodeBody')}</p>
            </div>
          </div>
        )}
        {activeTab === 'venue' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-gray-600">
            {t('comingSoon')}
          </div>
        )}
        {activeTab === 'day' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dayItselfTitle')}</h3>
            <TimelineComponent />
          </div>
        )}
        {activeTab === 'evening' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-gray-600">
            {t('comingSoon')}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RSVP() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { guest, loginWithToken } = useGuestAuth()
  const { t, setLanguage } = useLanguage()

  const [showGlitter, setShowGlitter] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('needToKnow')

  const storageKey = useMemo(() => (token ? `wedding_pass_progress:${token}` : null), [token])
  const hasHydratedFromStorage = useRef(false)

  // Persist token so the guest can jump back to their Wedding Pass from other pages (Info, etc.)
  useEffect(() => {
    if (!token) return
    try {
      localStorage.setItem('guest_invite_token', token)
    } catch {
      // ignore
    }
  }, [token])

  const [pass, setPass] = useState({
    rsvp_status: 'pending', // pending | confirmed | declined
    number_of_guests: 1,
    overnight_stay: false,
    dietary_restrictions: '',
    special_requests: '',
    step: 0,
    completed: false,
    photo: {
      file: null,
      previewUrl: null,
      caption: '',
      uploaded: false,
    },
  })

  // Fetch guest data by token
  const { data: guestData, isLoading: loadingGuest } = useQuery({
    queryKey: ['guest-by-token', token],
    queryFn: () => api.get(`/guests/token/${token}`).then((res) => res.data),
    enabled: !!token,
    retry: false,
  })

  // Authenticate with token
  const authMutation = useMutation({
    mutationFn: () => api.post(`/guests/token/${token}/auth`),
    onSuccess: (response) => {
      const { access_token, guest: guestInfo } = response.data
      loginWithToken(access_token, guestInfo)
      setLoading(false)
    },
    onError: (err) => {
      setError(err.response?.data?.error || t('authFailed'))
      setLoading(false)
    },
  })

  // Auto-authenticate when guest data is loaded
  useEffect(() => {
    if (guestData && !guest) {
      authMutation.mutate()
    } else if (guestData) {
      setLoading(false)
    }
  }, [guestData, guest])

  const originalGuestCount = useMemo(() => {
    const n = Number(guestData?.number_of_guests || 1)
    return Number.isFinite(n) && n > 0 ? n : 1
  }, [guestData?.number_of_guests])

  const isCoupleInvite = originalGuestCount === 2
  const isGroupInvite = originalGuestCount > 2

  // Populate pass state when guest data loads
  useEffect(() => {
    if (!guestData) return

    setPass((prev) => ({
      ...prev,
      rsvp_status: guestData.rsvp_status || 'pending',
      overnight_stay: !!guestData.overnight_stay,
      number_of_guests: Number(guestData.number_of_guests || 1),
      dietary_restrictions: guestData.dietary_restrictions || '',
      special_requests: guestData.special_requests || '',
      // if already responded and no stored progress, jump to done
      ...(guestData.rsvp_status === 'confirmed' || guestData.rsvp_status === 'declined'
        ? { completed: true }
        : {}),
    }))

    if (guestData.language) setLanguage(guestData.language)
  }, [guestData, setLanguage])

  // Hydrate progress from localStorage (token scoped). Never restore File.
  useEffect(() => {
    if (!storageKey || hasHydratedFromStorage.current) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      setPass((prev) => ({
        ...prev,
        ...parsed,
        photo: {
          ...prev.photo,
          ...(parsed.photo || {}),
          file: null,
        },
      }))
      hasHydratedFromStorage.current = true
    } catch {
      // ignore
    }
  }, [storageKey])

  // Persist progress to localStorage (without File)
  useEffect(() => {
    if (!storageKey) return
    const safe = {
      ...pass,
      photo: {
        ...pass.photo,
        file: null,
      },
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(safe))
    } catch {
      // ignore
    }
  }, [pass, storageKey])

  // Cleanup preview URL on unmount / change
  useEffect(() => {
    return () => {
      if (pass.photo.previewUrl) URL.revokeObjectURL(pass.photo.previewUrl)
    }
  }, [pass.photo.previewUrl])

  // Fetch images
  const { data: images } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  // Get images
  const heroImage = images?.find((img) => img.position === 'hero' && img.is_active && img.is_public)
  const rsvpImages = images
    ?.filter(
      (img) =>
        ['photo1', 'photo2', 'photo3'].includes(img.position) && img.is_active && img.is_public
    )
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)

  const updateRSVPMutation = useMutation({
    mutationFn: async (data) => {
      const guestToken = localStorage.getItem('guest_token')
      if (!guestToken) {
        if (token) {
          const authResponse = await api.post(`/guests/token/${token}/auth`)
          const { access_token } = authResponse.data
          localStorage.setItem('guest_token', access_token)
        } else {
          throw new Error(t('authMissing'))
        }
      }
      return api.put('/guests/update-rsvp', data)
    },
    onError: (err) => {
      console.error('Update error:', err)
      setError(err.response?.data?.error || err.message || t('saveFailed'))
    },
  })

  const uploadPhotoMutation = useMutation({
    mutationFn: (formData) => api.post('/guest-photos', formData),
    onError: (err) => {
      console.error('Photo upload error:', err)
      setError(err.response?.data?.error || err.message || t('photoUploadFailed'))
    },
  })

  const getWeddingDateLabel = () => {
    const fromContent = t('wedding_date')
    if (fromContent && fromContent !== 'wedding_date') return fromContent
    return t('ourBigDay')
  }

  const getWeddingDateISO = () => {
    const fromContent = t('wedding_date_iso')
    if (fromContent && fromContent !== 'wedding_date_iso') return fromContent
    return null
  }

  const weddingDateLabel = getWeddingDateLabel()
  const weddingDateISO = getWeddingDateISO()
  const canAddToCalendar = !!(weddingDateISO && /^\d{4}-\d{2}-\d{2}$/.test(weddingDateISO))

  const steps = useMemo(() => {
    const base = ['attendance']
    if (isCoupleInvite) base.push('couple')
    if (isGroupInvite) base.push('groupCount')
    base.push('overnight', 'dietary', 'notes', 'photo', 'done')
    return base
  }, [isCoupleInvite, isGroupInvite])

  const currentStepKey = steps[Math.min(pass.step, steps.length - 1)]

  const goPrev = () => setPass((p) => ({ ...p, step: Math.max(0, p.step - 1) }))
  const goNext = () => setPass((p) => ({ ...p, step: Math.min(steps.length - 1, p.step + 1) }))

  const savePartial = async (partial) => {
    setError('')
    await updateRSVPMutation.mutateAsync(partial)
  }

  const completePass = () => setPass((p) => ({ ...p, completed: true, step: steps.length - 1 }))

  const handleChooseAttendance = async (isYes) => {
    const status = isYes ? 'confirmed' : 'declined'
    setPass((p) => ({ ...p, rsvp_status: status }))
    await savePartial({ rsvp_status: status })

    if (isYes) {
      setShowGlitter(true)
      setTimeout(() => setShowGlitter(false), 1800)
      goNext()
      return
    }
    completePass()
  }

  const handleCoupleChoice = async (bothComing) => {
    const newCount = bothComing ? originalGuestCount : 1
    setPass((p) => ({ ...p, number_of_guests: newCount }))
    await savePartial({ number_of_guests: newCount })
    goNext()
  }

  const handleGroupCountNext = async () => {
    const clamped = Math.max(1, Math.min(originalGuestCount, pass.number_of_guests || 1))
    setPass((p) => ({ ...p, number_of_guests: clamped }))
    await savePartial({ number_of_guests: clamped })
    goNext()
  }

  const handleOvernight = async (value) => {
    setPass((p) => ({ ...p, overnight_stay: value }))
    await savePartial({ overnight_stay: value })
    goNext()
  }

  const handleDietaryNext = async () => {
    await savePartial({ dietary_restrictions: pass.dietary_restrictions || '' })
    goNext()
  }

  const handleNotesNext = async () => {
    await savePartial({ special_requests: pass.special_requests || '' })
    goNext()
  }

  const handlePhotoFile = (file) => {
    if (!file) return
    if (pass.photo.previewUrl) URL.revokeObjectURL(pass.photo.previewUrl)
    const previewUrl = URL.createObjectURL(file)
    setPass((p) => ({
      ...p,
      photo: { ...p.photo, file, previewUrl, uploaded: false },
    }))
  }

  const handleUploadPhoto = async () => {
    if (!pass.photo.file) {
      goNext()
      return
    }
    const fd = new FormData()
    fd.append('file', pass.photo.file)
    fd.append('caption', pass.photo.caption || '')
    await uploadPhotoMutation.mutateAsync(fd)
    setPass((p) => ({ ...p, photo: { ...p.photo, uploaded: true } }))
    goNext()
  }

  const downloadIcs = () => {
    if (!canAddToCalendar) return
    const dtStart = weddingDateISO.replaceAll('-', '')
    const dtEndDate = new Date(`${weddingDateISO}T00:00:00`)
    dtEndDate.setDate(dtEndDate.getDate() + 1)
    const endIso = dtEndDate.toISOString().slice(0, 10).replaceAll('-', '')
    const uid = `wedding-${token || 'guest'}@weddingpass`
    const summary = t('calendarEventTitle')
    const description = t('calendarEventDescription')
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wedding Planner//Wedding Pass//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${endIso}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wedding.ics'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (loading || loadingGuest || authMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="text-center">
          <Loader className="w-12 h-12 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('loadingWeddingPass')}</p>
        </div>
      </div>
    )
  }

  if (!guestData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('invalidInvitationLinkTitle')}</h2>
            <p className="text-gray-600 mb-6">{t('invalidInvitationLinkMessage')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <GlitterAnimation show={showGlitter} onComplete={() => setShowGlitter(false)} />

      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden">
        {heroImage ? (
          <div className="relative h-64 md:h-96 overflow-hidden">
            <img
              src={heroImage.url}
              alt={heroImage.alt_text || 'Couple Photo'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-4xl mx-auto text-center px-4">
                <p className="text-white/90 text-sm tracking-wide mb-2 drop-shadow-md">
                  {t('yourInvitation')}
                </p>
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-3 drop-shadow-lg">
                  {t('yourWeddingPass')}
                </h1>
                <p className="text-xl text-white/90 drop-shadow-md">
                  {t('hi')} {guestData.first_name}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-64 md:h-96 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-4xl mx-auto text-center px-4">
                <p className="text-white/90 text-sm tracking-wide mb-2 drop-shadow-md">
                  {t('yourInvitation')}
                </p>
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-3 drop-shadow-lg">
                  {t('yourWeddingPass')}
                </h1>
                <p className="text-xl text-white/90 drop-shadow-md">
                  {t('hi')} {guestData.first_name}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left: photos */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('joinOurCelebration')}</h2>
            <p className="text-gray-600">{t('passIntro')}</p>
            <div className="space-y-4">
              {rsvpImages && rsvpImages.length > 0 ? (
                rsvpImages.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative rounded-2xl overflow-hidden shadow-lg"
                    style={{ aspectRatio: '21/29' }}
                  >
                    <img
                      src={image.url}
                      alt={image.alt_text || `Wedding Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))
              ) : (
                <>
                  {[1, 2, 3].map((num) => (
                    <div
                      key={num}
                      className="relative bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl overflow-hidden flex items-center justify-center"
                      style={{ aspectRatio: '21/29' }}
                    >
                      <div className="text-center">
                        <Camera className="w-12 h-12 text-white/80 mx-auto mb-2" />
                        <p className="text-white/90 text-sm">Photo {num}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Right: widget */}
          <div>
            <div className="lg:sticky lg:top-8">
              <PassCard>
                {error ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-between mb-5">
                  <div className="text-sm text-gray-600">
                    {t('stepLabel')} {Math.min(pass.step + 1, steps.length)} / {steps.length}
                  </div>
                  <div className="text-sm text-gray-600">
                    {pass.rsvp_status === 'confirmed'
                      ? t('statusYes')
                      : pass.rsvp_status === 'declined'
                        ? t('statusNo')
                        : t('statusPending')}
                  </div>
                </div>

                {currentStepKey === 'attendance' && (
                  <StepShell
                    title={t('qCelebrateOnDate').replace('{{date}}', weddingDateLabel)}
                    subtitle={t('qCelebrateSub')}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton
                        onClick={() => handleChooseAttendance(true)}
                        disabled={updateRSVPMutation.isPending}
                      >
                        {t('yes')}
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        onClick={() => handleChooseAttendance(false)}
                        disabled={updateRSVPMutation.isPending}
                      >
                        {t('no')}
                      </PrimaryButton>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">{t('youCanEditAnytime')}</p>
                  </StepShell>
                )}

                {currentStepKey === 'couple' && (
                  <StepShell title={t('qBothComing')} subtitle={t('qBothComingSub')}>
                    <div className="space-y-3">
                      <PrimaryButton
                        onClick={() => handleCoupleChoice(true)}
                        disabled={updateRSVPMutation.isPending}
                      >
                        {t('bothOfUs')}
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        onClick={() => handleCoupleChoice(false)}
                        disabled={updateRSVPMutation.isPending}
                      >
                        {t('justMe')}
                      </PrimaryButton>
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t('back')}
                      </button>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'groupCount' && (
                  <StepShell title={t('qGroupHowMany')} subtitle={t('qGroupHowManySub').replace('{{max}}', String(originalGuestCount))}>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setPass((p) => ({
                              ...p,
                              number_of_guests: Math.max(1, (p.number_of_guests || 1) - 1),
                            }))
                          }
                          className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 font-semibold"
                        >
                          −
                        </button>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-gray-900">{pass.number_of_guests || 1}</div>
                          <div className="text-sm text-gray-600">{t('people')}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPass((p) => ({
                              ...p,
                              number_of_guests: Math.min(originalGuestCount, (p.number_of_guests || 1) + 1),
                            }))
                          }
                          className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 font-semibold"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">{t('groupMaxNote').replace('{{max}}', String(originalGuestCount))}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton variant="secondary" onClick={goPrev}>
                        <span className="flex items-center justify-center gap-2">
                          <ChevronLeft className="w-4 h-4" /> {t('back')}
                        </span>
                      </PrimaryButton>
                      <PrimaryButton onClick={handleGroupCountNext} disabled={updateRSVPMutation.isPending}>
                        <span className="flex items-center justify-center gap-2">
                          {t('next')} <ChevronRight className="w-4 h-4" />
                        </span>
                      </PrimaryButton>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'overnight' && (
                  <StepShell title={t('qOvernight')} subtitle={t('qOvernightSub')}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton
                        onClick={() => handleOvernight(true)}
                        disabled={updateRSVPMutation.isPending}
                      >
                        {t('yes')}
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        onClick={() => handleOvernight(false)}
                        disabled={updateRSVPMutation.isPending}
                      >
                        {t('no')}
                      </PrimaryButton>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">{t('overnightNoteSoft')}</p>
                    <div className="mt-5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t('back')}
                      </button>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'dietary' && (
                  <StepShell title={t('qDietary')} subtitle={t('qDietarySub')}>
                    <textarea
                      rows={4}
                      value={pass.dietary_restrictions}
                      onChange={(e) =>
                        setPass((p) => ({ ...p, dietary_restrictions: e.target.value }))
                      }
                      placeholder={t('dietaryPlaceholderShort')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900 bg-white"
                    />
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton variant="secondary" onClick={goPrev}>
                        <span className="flex items-center justify-center gap-2">
                          <ChevronLeft className="w-4 h-4" /> {t('back')}
                        </span>
                      </PrimaryButton>
                      <PrimaryButton onClick={handleDietaryNext} disabled={updateRSVPMutation.isPending}>
                        <span className="flex items-center justify-center gap-2">
                          {t('next')} <ChevronRight className="w-4 h-4" />
                        </span>
                      </PrimaryButton>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'notes' && (
                  <StepShell title={t('qNotes')} subtitle={t('qNotesSub')}>
                    <textarea
                      rows={4}
                      value={pass.special_requests}
                      onChange={(e) => setPass((p) => ({ ...p, special_requests: e.target.value }))}
                      placeholder={t('notesPlaceholder')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900 bg-white"
                    />
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton variant="secondary" onClick={goPrev}>
                        <span className="flex items-center justify-center gap-2">
                          <ChevronLeft className="w-4 h-4" /> {t('back')}
                        </span>
                      </PrimaryButton>
                      <PrimaryButton onClick={handleNotesNext} disabled={updateRSVPMutation.isPending}>
                        <span className="flex items-center justify-center gap-2">
                          {t('next')} <ChevronRight className="w-4 h-4" />
                        </span>
                      </PrimaryButton>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'photo' && (
                  <StepShell title={t('qAddPhoto')} subtitle={t('qAddPhotoSub')}>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                          className="block w-full text-sm text-gray-700"
                        />

                        {pass.photo.previewUrl ? (
                          <div className="mt-4">
                            <img
                              src={pass.photo.previewUrl}
                              alt="Preview"
                              className="w-full rounded-xl object-cover"
                              style={{ aspectRatio: '4/3' }}
                            />
                            <input
                              type="text"
                              value={pass.photo.caption}
                              onChange={(e) =>
                                setPass((p) => ({
                                  ...p,
                                  photo: { ...p.photo, caption: e.target.value },
                                }))
                              }
                              placeholder={t('photoCaptionPlaceholder')}
                              className="mt-3 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900 bg-white"
                            />
                            {pass.photo.uploaded ? (
                              <p className="mt-2 text-sm text-green-700 flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                {t('photoUploaded')}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-gray-600">{t('photoOptional')}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <PrimaryButton variant="secondary" onClick={goPrev}>
                          <span className="flex items-center justify-center gap-2">
                            <ChevronLeft className="w-4 h-4" /> {t('back')}
                          </span>
                        </PrimaryButton>
                        <PrimaryButton onClick={handleUploadPhoto} disabled={uploadPhotoMutation.isPending}>
                          {pass.photo.file ? t('uploadAndContinue') : t('continue')}
                        </PrimaryButton>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={goNext}
                          className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
                        >
                          {t('skipForNow')}
                        </button>
                      </div>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'done' && (
                  <StepShell
                    title={
                      pass.rsvp_status === 'confirmed'
                        ? t('doneYesTitle')
                        : pass.rsvp_status === 'declined'
                          ? t('doneNoTitle')
                          : t('doneTitle')
                    }
                    subtitle={
                      pass.rsvp_status === 'confirmed'
                        ? t('doneYesSub')
                        : pass.rsvp_status === 'declined'
                          ? t('doneNoSub')
                          : t('doneSub')
                    }
                  >
                    <div className="space-y-3">
                      <PrimaryButton onClick={downloadIcs} disabled={!canAddToCalendar}>
                        <span className="flex items-center justify-center gap-2">
                          <CalendarPlus className="w-5 h-5" />
                          {t('addToCalendar')}
                        </span>
                      </PrimaryButton>
                      {!canAddToCalendar ? (
                        <p className="text-xs text-gray-500">{t('calendarNotConfigured')}</p>
                      ) : null}

                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">{t('saveThisPageTitle')}</span>{' '}
                          {t('saveThisPageBody')}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">{t('whyReturnTitle')}</span>{' '}
                          {t('whyReturnBody')}
                        </p>
                      </div>

                      <PrimaryButton variant="secondary" onClick={() => setPass((p) => ({ ...p, step: 0 }))}>
                        {t('editAnswers')}
                      </PrimaryButton>
                      <PrimaryButton variant="secondary" onClick={() => navigate('/info')}>
                        {t('openFullInfo')}
                      </PrimaryButton>
                    </div>

                    <PostContent
                      t={t}
                      TimelineComponent={Timeline}
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      MapPinIcon={MapPin}
                      NotebookPenIcon={NotebookPen}
                    />
                  </StepShell>
                )}
              </PassCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

