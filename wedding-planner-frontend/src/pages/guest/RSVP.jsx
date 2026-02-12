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
} from 'lucide-react'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import HeartBurstAnimation from '../../components/HeartBurstAnimation'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import SavePageBlock from '../../components/SavePageBlock'
import StyledTitle from '../../components/StyledTitle'
import api from '../../lib/api'

function PassCard({ children }) {
  return <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">{children}</div>
}

function PrimaryButton({ children, onClick, disabled, variant = 'primary', className = '' }) {
  const base =
    'w-full py-4 px-5 rounded-xl font-semibold text-lg transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'primary'
      ? 'text-white'
      : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles} ${className}`}
      style={
        variant === 'primary'
          ? {
              background: 'linear-gradient(135deg, var(--wp-primary), var(--wp-secondary))',
            }
          : undefined
      }
    >
      {children}
    </button>
  )
}

function StepShell({ title, subtitle, children }) {
  return (
    <div className="transition-all duration-200 ease-out">
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

// Note: we intentionally keep deeper info on the /info page, not on the final step here.

export default function RSVP({ token: tokenOverride, embedded = false, onClose }) {
  const { token: tokenFromRoute } = useParams()
  const token = tokenOverride || tokenFromRoute
  const navigate = useNavigate()
  const { guest, loginWithToken } = useGuestAuth()
  const { t, setLanguage } = useLanguage()

  const [showHearts, setShowHearts] = useState(false)
  const [isStepFading, setIsStepFading] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState('next')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false)
  const [containerMinHeight, setContainerMinHeight] = useState(undefined)

  const stepContainerRef = useRef(null)
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
    attending_names: [],
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
    if (!guestData) return
    // If the browser previously logged in as a different guest, force re-auth for this invite token.
    if (!guest || guest?.id !== guestData?.id) {
      authMutation.mutate()
      return
    }
    // If we have the right guest but no token, also re-auth
    const guestToken = localStorage.getItem('guest_token')
    if (!guestToken) {
      authMutation.mutate()
      return
    }
    setLoading(false)
  }, [guestData, guest])

  const originalGuestCount = useMemo(() => {
    const n = Number(guestData?.number_of_guests || 1)
    return Number.isFinite(n) && n > 0 ? n : 1
  }, [guestData?.number_of_guests])

  const inviteeNames = useMemo(() => {
    const names = Array.isArray(guestData?.invitee_names) ? guestData.invitee_names : []
    const cleaned = names.map((n) => (n || '').trim()).filter(Boolean)
    if (cleaned.length) return cleaned
    const primary = `${guestData?.first_name || ''} ${guestData?.last_name || ''}`.trim()
    return primary ? [primary] : []
  }, [guestData?.invitee_names, guestData?.first_name, guestData?.last_name])

  const invitedCount = inviteeNames.length || 1
  const isCoupleInvite = invitedCount === 2
  const isGroupInvite = invitedCount > 2
  const isPlural = isCoupleInvite || isGroupInvite

  // Helper to get plural form of translation for couples/groups
  // Falls back to singular if plural form doesn't exist
  const tp = (key, params) => {
    if (isPlural) {
      const pluralKey = `${key}_plural`
      const pluralValue = t(pluralKey, params)
      // If plural translation exists (not same as key), use it
      if (pluralValue !== pluralKey) {
        return pluralValue
      }
    }
    return t(key, params)
  }

  // Populate pass state when guest data loads
  useEffect(() => {
    if (!guestData) return

    // Derive attending names (prefer explicit attending_names if present)
    const explicitAttending = Array.isArray(guestData.attending_names)
      ? guestData.attending_names.map((n) => (n || '').trim()).filter(Boolean)
      : []

    let inferredAttending = []
    if (explicitAttending.length) {
      inferredAttending = explicitAttending
    } else if (guestData.rsvp_status === 'confirmed') {
      if (inviteeNames.length) {
        const count = Math.max(1, Number(guestData.number_of_guests || 1))
        inferredAttending = inviteeNames.slice(0, Math.min(inviteeNames.length, count))
      } else {
        inferredAttending = []
      }
    } else if (guestData.rsvp_status === 'declined') {
      inferredAttending = []
    }

    // If status is pending, reset everything to start fresh (step 0)
    // This handles the case when admin sets status back to pending
    const isPending = !guestData.rsvp_status || guestData.rsvp_status === 'pending'
    
    if (isPending && storageKey) {
      // Clear localStorage to ensure wizard starts from beginning
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // ignore
      }
    }

    setPass((prev) => ({
      ...prev,
      rsvp_status: guestData.rsvp_status || 'pending',
      // Reset all fields to defaults when status is pending
      overnight_stay: isPending ? false : !!guestData.overnight_stay,
      number_of_guests: isPending ? 1 : Number(guestData.number_of_guests || 1),
      attending_names: isPending ? [] : inferredAttending,
      dietary_restrictions: isPending ? '' : (guestData.dietary_restrictions || ''),
      special_requests: isPending ? '' : (guestData.special_requests || ''),
      // Reset step to 0 for pending status, jump to done for confirmed/declined
      step: isPending ? 0 : prev.step,
      completed: guestData.rsvp_status === 'confirmed' || guestData.rsvp_status === 'declined',
    }))

    if (guestData.language) setLanguage(guestData.language)
  }, [guestData, setLanguage, storageKey])

  // Hydrate progress from localStorage (token scoped). Never restore File.
  // Skip hydration for pending status - we want a fresh start
  useEffect(() => {
    if (!storageKey || hasHydratedFromStorage.current) return
    // Don't hydrate if status is pending (admin reset or new guest)
    if (!guestData?.rsvp_status || guestData.rsvp_status === 'pending') {
      hasHydratedFromStorage.current = true
      return
    }
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
  }, [storageKey, guestData?.rsvp_status])

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

  // Fetch content for booking link
  const { language } = useLanguage()
  const { data: contentData } = useQuery({
    queryKey: ['content', language],
    queryFn: () => api.get(`/content?lang=${language}`).then((res) => res.data),
  })

  // Get booking link from content
  const bookingLink = contentData?.guest_accommodation_booking_link || ''

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
      // Ensure the guest token matches this invite token (avoid "Guest not found" with stale guest_token)
      if (!token) throw new Error(t('authMissing'))
      if (!guestData) throw new Error(t('authMissing'))

      const storedGuestRaw = localStorage.getItem('guest')
      let storedGuestId = null
      try {
        storedGuestId = storedGuestRaw ? JSON.parse(storedGuestRaw)?.id : null
      } catch {
        storedGuestId = null
      }

      const guestToken = localStorage.getItem('guest_token')
      const tokenLooksStale = !guestToken || (storedGuestId && storedGuestId !== guestData.id)
      if (tokenLooksStale) {
        const authResponse = await api.post(`/guests/token/${token}/auth`)
        const { access_token, guest: guestInfo } = authResponse.data
        localStorage.setItem('guest_token', access_token)
        if (guestInfo) {
          localStorage.setItem('guest', JSON.stringify(guestInfo))
        }
      }

      try {
        return await api.put('/guests/update-rsvp', data)
      } catch (err) {
        // One retry if backend says guest not found (stale token edge case)
        const status = err?.response?.status
        const msg = err?.response?.data?.error
        if (status === 404 && msg && msg.toLowerCase().includes('guest not found')) {
          const authResponse = await api.post(`/guests/token/${token}/auth`)
          const { access_token, guest: guestInfo } = authResponse.data
          localStorage.setItem('guest_token', access_token)
          if (guestInfo) localStorage.setItem('guest', JSON.stringify(guestInfo))
          return await api.put('/guests/update-rsvp', data)
        }
        throw err
      }
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
    if (isGroupInvite) base.push('group')
    base.push('overnight', 'dietary', 'notes', 'done')
    return base
  }, [isCoupleInvite, isGroupInvite])

  const currentStepKey = steps[Math.min(pass.step, steps.length - 1)]

  const transitionToStep = (nextStep) => {
    // Lock current height so the container doesn't jump during fade-out
    if (stepContainerRef.current) {
      setContainerMinHeight(stepContainerRef.current.offsetHeight)
    }
    setTransitionDirection(nextStep > (pass.step ?? 0) ? 'next' : 'prev')
    setIsStepFading(true)
    setTimeout(() => {
      setPass((p) => ({ ...p, step: nextStep }))
      requestAnimationFrame(() => {
        setIsStepFading(false)
        // After new content renders, animate min-height to the new size
        requestAnimationFrame(() => {
          const newH = stepContainerRef.current?.scrollHeight
          if (newH) setContainerMinHeight(newH)
          setTimeout(() => setContainerMinHeight(undefined), 450)
        })
      })
    }, 400)
  }

  // Navigation helpers:
  // - defined in one place to avoid "goNext is not defined" regressions
  // - uses functional updates so step math always uses the latest state
  const transitionBy = (delta) => {
    // Lock current height so the container doesn't jump during fade-out
    if (stepContainerRef.current) {
      setContainerMinHeight(stepContainerRef.current.offsetHeight)
    }
    setTransitionDirection(delta > 0 ? 'next' : 'prev')
    setIsStepFading(true)
    setTimeout(() => {
      setPass((p) => {
        const next = Math.min(steps.length - 1, Math.max(0, (p.step || 0) + delta))
        return { ...p, step: next }
      })
      requestAnimationFrame(() => {
        setIsStepFading(false)
        // After new content renders, animate min-height to the new size
        requestAnimationFrame(() => {
          const newH = stepContainerRef.current?.scrollHeight
          if (newH) setContainerMinHeight(newH)
          setTimeout(() => setContainerMinHeight(undefined), 450)
        })
      })
    }, 400)
  }

  // Focus management and scroll when step changes
  useEffect(() => {
    if (isStepFading) return
    const timer = setTimeout(() => {
      stepContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const focusable = stepContainerRef.current?.querySelector(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
      )
      if (focusable && typeof focusable.focus === 'function') {
        focusable.focus({ preventScroll: true })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [pass.step, isStepFading])

  const goPrev = () => transitionBy(-1)
  const goNext = () => transitionBy(1)

  // Backwards-compatible aliases (some UI handlers reference these names)
  const goPrevSmooth = goPrev
  const goNextSmooth = goNext

  const savePartial = async (partial) => {
    setError('')
    await updateRSVPMutation.mutateAsync(partial)
  }

  const completePass = () => setPass((p) => ({ ...p, completed: true, step: steps.length - 1 }))

  const handleChooseAttendance = async (isYes) => {
    const status = isYes ? 'confirmed' : 'declined'
    let nextAttending = []
    if (status === 'confirmed') {
      if (!isCoupleInvite && !isGroupInvite) {
        nextAttending = inviteeNames.slice(0, 1)
      } else if (isCoupleInvite) {
        // default to both; user can adjust on next step
        nextAttending = inviteeNames.slice(0, 2)
      } else if (isGroupInvite) {
        // default to everyone; user can adjust on next step
        nextAttending = inviteeNames.slice()
      }
    }

    setPass((p) => ({ ...p, rsvp_status: status, attending_names: nextAttending }))
    await savePartial({ rsvp_status: status, attending_names: nextAttending })

    if (isYes) {
      setShowHearts(true)
      // Step transition will happen when hearts complete
      return
    }

    // decline is confirmed via modal; do nothing here
  }

  const confirmDecline = async () => {
    setShowDeclineConfirm(false)
    const status = 'declined'
    const nextAttending = []
    setPass((p) => ({ ...p, rsvp_status: status, attending_names: nextAttending }))
    await savePartial({ rsvp_status: status, attending_names: nextAttending })
    completePass()
  }

  const handleCoupleChoice = async (choice) => {
    // choice: 'both' | 'first' | 'second'
    const name1 = inviteeNames[0]
    const name2 = inviteeNames[1]
    const nextAttending =
      choice === 'both' ? [name1, name2] : choice === 'second' ? [name2] : [name1]
    setPass((p) => ({ ...p, attending_names: nextAttending }))
    await savePartial({ attending_names: nextAttending })
    goNext()
  }

  const toggleGroupName = (name) => {
    setPass((p) => {
      const set = new Set(p.attending_names || [])
      if (set.has(name)) set.delete(name)
      else set.add(name)
      return { ...p, attending_names: Array.from(set) }
    })
  }

  const handleGroupNext = async () => {
    const cleaned = (pass.attending_names || []).filter((n) => inviteeNames.includes(n))
    const finalNames = cleaned.length ? cleaned : inviteeNames.slice(0, 1)
    setPass((p) => ({ ...p, attending_names: finalNames }))
    await savePartial({ attending_names: finalNames })
    goNext()
  }

  const handleOvernight = async (value) => {
    setPass((p) => ({ ...p, overnight_stay: value }))
    await savePartial({ overnight_stay: value })
    // If "No", proceed immediately. If "Yes", stay to show booking info
    if (!value) {
      goNext()
    }
  }

  const handleOvernightContinue = () => {
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
      <div
        className={embedded ? 'flex items-center justify-center' : 'min-h-screen flex items-center justify-center'}
        style={
          embedded
            ? undefined
            : { background: 'linear-gradient(135deg, var(--wp-primary-5), var(--wp-background), var(--wp-secondary-5))' }
        }
      >
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: 'var(--wp-primary)' }} />
          <p className="text-gray-600">{t('loadingWeddingPass')}</p>
        </div>
      </div>
    )
  }

  if (!guestData) {
    return (
      <div
        className={embedded ? 'flex items-center justify-center' : 'min-h-screen flex items-center justify-center'}
        style={
          embedded
            ? undefined
            : { background: 'linear-gradient(135deg, var(--wp-primary-5), var(--wp-background), var(--wp-secondary-5))' }
        }
      >
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
    <div
      className={embedded ? '' : 'min-h-screen'}
      style={
        embedded
          ? undefined
          : { background: 'linear-gradient(135deg, var(--wp-primary-5), var(--wp-background), var(--wp-secondary-5))' }
      }
    >
      <HeartBurstAnimation show={showHearts} onComplete={() => {
        setShowHearts(false)
        goNextSmooth()
      }} />

      {/* Language Switcher */}
      {!embedded ? (
        <div className="absolute top-4 right-4 z-10">
          <LanguageSwitcher />
        </div>
      ) : null}

      {/* Hero */}
      {!embedded ? (
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
                  <StyledTitle text={t('yourWeddingPass')} />
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
                  <StyledTitle text={t('yourWeddingPass')} />
                </h1>
                <p className="text-xl text-white/90 drop-shadow-md">
                  {t('hi')} {guestData.first_name}
                </p>
              </div>
            </div>
          </div>
        )}
        </div>
      ) : null}

      {/* Main */}
      <div className={embedded ? 'px-4 sm:px-6 py-6' : 'max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12'}>
        <div className={embedded ? 'max-w-lg mx-auto' : 'grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8'}>
          {/* Left: photos */}
          {!embedded ? (
            <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('joinOurCelebration')}</h2>
            <p className="text-gray-600">{t('passIntro')}</p>
            <div className="grid grid-cols-2 gap-4">
              {rsvpImages && rsvpImages.length > 0 ? (
                <>
                  {/* Big lead image */}
                  {rsvpImages[0] && (
                    <div className="col-span-2 relative rounded-2xl overflow-hidden shadow-lg bg-white" style={{ aspectRatio: '16/9' }}>
                      <img
                        src={rsvpImages[0].url}
                        alt={rsvpImages[0].alt_text || 'Wedding photo'}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {/* Two supporting images */}
                  {rsvpImages.slice(1, 3).map((image) => (
                    <div key={image.id} className="relative rounded-2xl overflow-hidden shadow-lg bg-white" style={{ aspectRatio: '4/5' }}>
                      <img
                        src={image.url}
                        alt={image.alt_text || 'Wedding photo'}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                      />
                    </div>
                  ))}
                  {/* If only one image exists, fill the second row with a soft placeholder */}
                  {(!rsvpImages[1] || !rsvpImages[2]) &&
                    Array.from({ length: 2 - rsvpImages.slice(1, 3).length }).map((_, idx) => (
                      <div
                        key={`ph-${idx}`}
                        className="relative bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl overflow-hidden flex items-center justify-center"
                        style={{ aspectRatio: '4/5' }}
                      >
                        <div className="text-center">
                          <Camera className="w-12 h-12 text-white/80 mx-auto mb-2" />
                          <p className="text-white/90 text-sm">{t('comingSoon')}</p>
                        </div>
                      </div>
                    ))}
                </>
              ) : (
                <>
                  <div className="col-span-2 relative bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 rounded-2xl overflow-hidden flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
                    <div className="text-center">
                      <Camera className="w-12 h-12 text-white/80 mx-auto mb-2" />
                      <p className="text-white/90 text-sm">Photo</p>
                    </div>
                  </div>
                  {[1, 2].map((num) => (
                    <div
                      key={num}
                      className="relative bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl overflow-hidden flex items-center justify-center"
                      style={{ aspectRatio: '4/5' }}
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
          ) : null}

          {/* Right: widget */}
          <div>
            <div className="lg:sticky lg:top-8">
              <PassCard>
                <div className="min-h-[3rem] mb-5">
                  {error ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                      {error}
                    </div>
                  ) : null}
                </div>

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

                <div
                  ref={stepContainerRef}
                  className={`transition-all duration-400 ease-out ${
                    isStepFading
                      ? `opacity-0 ${transitionDirection === 'next' ? 'translate-x-4' : '-translate-x-4'}`
                      : 'opacity-100 translate-x-0'
                  }`}
                  style={containerMinHeight !== undefined ? { minHeight: `${containerMinHeight}px` } : undefined}
                >
                {currentStepKey === 'attendance' && (
                  <StepShell
                    title={tp('qCelebrateOnDate').replace('{{date}}', weddingDateLabel)}
                    subtitle={tp('qCelebrateSub')}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton
                        onClick={() => handleChooseAttendance(true)}
                        disabled={updateRSVPMutation.isPending || isStepFading}
                      >
                        {t('yes')}
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        onClick={() => setShowDeclineConfirm(true)}
                        disabled={updateRSVPMutation.isPending || isStepFading}
                      >
                        {t('no')}
                      </PrimaryButton>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">{tp('youCanEditAnytime')}</p>
                  </StepShell>
                )}

                {currentStepKey === 'couple' && (
                  <StepShell title={t('qBothComing')} subtitle={t('qBothComingSub')}>
                    <div className="space-y-3">
                      <PrimaryButton
                        onClick={() => handleCoupleChoice('both')}
                        disabled={updateRSVPMutation.isPending || isStepFading}
                      >
                        {t('bothOfUs')} ({inviteeNames[0]} + {inviteeNames[1]})
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        onClick={() => handleCoupleChoice('first')}
                        disabled={updateRSVPMutation.isPending || isStepFading}
                      >
                        {t('onlyName').replace('{{name}}', inviteeNames[0] || t('name1'))}
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        onClick={() => handleCoupleChoice('second')}
                        disabled={updateRSVPMutation.isPending || isStepFading}
                      >
                        {t('onlyName').replace('{{name}}', inviteeNames[1] || t('name2'))}
                      </PrimaryButton>
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={goPrevSmooth}
                        disabled={isStepFading}
                        className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t('back')}
                      </button>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'group' && (
                  <StepShell
                    title={t('qGroupWhoComing')}
                    subtitle={t('qGroupWhoComingSub')}
                  >
                    <div className="space-y-2">
                      {inviteeNames.map((name) => {
                        const checked = (pass.attending_names || []).includes(name)
                        return (
                          <label
                            key={name}
                            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white cursor-pointer"
                          >
                            <span className="text-gray-900 font-medium">{name}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleGroupName(name)}
                              className="w-5 h-5"
                            />
                          </label>
                        )
                      })}
                    </div>

                    <div className="mt-3 text-sm text-gray-600">
                      {t('selectedCount')
                        .replace('{{count}}', String((pass.attending_names || []).length))
                        .replace('{{max}}', String(invitedCount))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton variant="secondary" onClick={goPrev} disabled={isStepFading}>
                        <span className="flex items-center justify-center gap-2">
                          <ChevronLeft className="w-4 h-4" /> {t('back')}
                        </span>
                      </PrimaryButton>
                      <PrimaryButton onClick={handleGroupNext} disabled={updateRSVPMutation.isPending || isStepFading}>
                        <span className="flex items-center justify-center gap-2">
                          {t('next')} <ChevronRight className="w-4 h-4" />
                        </span>
                      </PrimaryButton>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'overnight' && (
                  <StepShell title={tp('qOvernight')} subtitle={tp('qOvernightSub')}>
                    {/* Show Yes/No buttons only if not yet selected "Yes" */}
                    {!pass.overnight_stay && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <PrimaryButton
                          onClick={() => handleOvernight(true)}
                          disabled={updateRSVPMutation.isPending || isStepFading}
                        >
                          {t('yes')}
                        </PrimaryButton>
                        <PrimaryButton
                          variant="secondary"
                          onClick={() => handleOvernight(false)}
                          disabled={updateRSVPMutation.isPending || isStepFading}
                        >
                          {t('no')}
                        </PrimaryButton>
                      </div>
                    )}
                    {/* Booking link info - shown when overnight_stay is selected as yes */}
                    {pass.overnight_stay && (
                      <>
                        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--wp-primary-20)' }}>
                          {bookingLink ? (
                            <p className="text-sm" style={{ color: 'var(--wp-primary)' }}>
                              {t('bookingLinkHint')}{' '}
                              <a
                                href={bookingLink}
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
                          <p className="text-sm mt-2" style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>
                            {t('overnightAccommodationHint')}
                          </p>
                        </div>
                        {/* Continue button after seeing booking info */}
                        <div className="mt-4">
                          <PrimaryButton onClick={handleOvernightContinue} disabled={isStepFading}>
                            <span className="flex items-center justify-center gap-2">
                              {t('continue')} <ChevronRight className="w-4 h-4" />
                            </span>
                          </PrimaryButton>
                        </div>
                      </>
                    )}
                    <p className="text-xs text-gray-500 mt-4">{t('overnightNoteSoft')}</p>
                    <div className="mt-5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={goPrevSmooth}
                        disabled={isStepFading}
                        className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t('back')}
                      </button>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'dietary' && (
                  <StepShell title={tp('qDietary')} subtitle={tp('qDietarySub')}>
                    <textarea
                      rows={4}
                      value={pass.dietary_restrictions}
                      onChange={(e) =>
                        setPass((p) => ({ ...p, dietary_restrictions: e.target.value }))
                      }
                      placeholder={t('dietaryPlaceholderShort')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white"
                      style={{ outline: 'none' }}
                    />
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton variant="secondary" onClick={goPrevSmooth} disabled={isStepFading}>
                        <span className="flex items-center justify-center gap-2">
                          <ChevronLeft className="w-4 h-4" /> {t('back')}
                        </span>
                      </PrimaryButton>
                      <PrimaryButton onClick={handleDietaryNext} disabled={updateRSVPMutation.isPending || isStepFading}>
                        <span className="flex items-center justify-center gap-2">
                          {t('next')} <ChevronRight className="w-4 h-4" />
                        </span>
                      </PrimaryButton>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'notes' && (
                  <StepShell title={tp('qNotes')} subtitle={tp('qNotesSub')}>
                    <textarea
                      rows={4}
                      value={pass.special_requests}
                      onChange={(e) => setPass((p) => ({ ...p, special_requests: e.target.value }))}
                      placeholder={t('notesPlaceholder')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white"
                      style={{ outline: 'none' }}
                    />
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PrimaryButton variant="secondary" onClick={goPrevSmooth} disabled={isStepFading}>
                        <span className="flex items-center justify-center gap-2">
                          <ChevronLeft className="w-4 h-4" /> {t('back')}
                        </span>
                      </PrimaryButton>
                      <PrimaryButton onClick={handleNotesNext} disabled={updateRSVPMutation.isPending || isStepFading}>
                        <span className="flex items-center justify-center gap-2">
                          {t('finish')} <Check className="w-4 h-4" />
                        </span>
                      </PrimaryButton>
                    </div>
                  </StepShell>
                )}

                {currentStepKey === 'done' && (
                  <StepShell
                    title={
                      pass.rsvp_status === 'confirmed'
                        ? t('doneYesTitle')
                        : pass.rsvp_status === 'declined'
                          ? t('declinedSadTitle')
                          : t('doneTitle')
                    }
                    subtitle={
                      pass.rsvp_status === 'confirmed'
                        ? t('doneYesSub')
                        : pass.rsvp_status === 'declined'
                          ? t('declinedSadSub')
                          : t('doneSub')
                    }
                  >
                    <div className="space-y-3">
                      {embedded ? (
                        <>
                          {/* Embedded mode: show done button to close popup */}
                          <PrimaryButton onClick={() => onClose?.()}>
                            <span className="flex items-center justify-center gap-2">
                              <Check className="w-5 h-5" />
                              {t('done') || 'Done'}
                            </span>
                          </PrimaryButton>
                          
                          <PrimaryButton variant="secondary" onClick={downloadIcs} disabled={!canAddToCalendar}>
                            <span className="flex items-center justify-center gap-2">
                              <CalendarPlus className="w-5 h-5" />
                              {t('addToCalendar')}
                            </span>
                          </PrimaryButton>
                        </>
                      ) : (
                        <>
                          {/* Full page mode: show all options */}
                          <PrimaryButton onClick={downloadIcs} disabled={!canAddToCalendar}>
                            <span className="flex items-center justify-center gap-2">
                              <CalendarPlus className="w-5 h-5" />
                              {t('addToCalendar')}
                            </span>
                          </PrimaryButton>
                          {!canAddToCalendar ? (
                            <p className="text-xs text-gray-500">{t('calendarNotConfigured')}</p>
                          ) : null}

                          <SavePageBlock />

                          <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <p className="text-sm text-gray-700">
                              <span className="font-semibold text-gray-900">{t('whyReturnTitle')}</span>{' '}
                              {t('whyReturnBody')}
                            </p>
                          </div>

                          <PrimaryButton variant="secondary" onClick={() => navigate('/info')}>
                            {t('openFullInfo')}
                          </PrimaryButton>
                        </>
                      )}
                    </div>
                  </StepShell>
                )}
                </div>
              </PassCard>
              {/* Close button removed - guests automatically exit wizard after completing it */}
            </div>
          </div>
        </div>
      </div>

      {showDeclineConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeclineConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900">{t('declineConfirmTitle')}</h3>
            <p className="text-gray-600 mt-2">{t('declineConfirmBody')}</p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowDeclineConfirm(false)}
                className="w-full py-3 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 font-semibold hover:bg-gray-50"
              >
                {t('declineConfirmBack')}
              </button>
              <button
                type="button"
                onClick={confirmDecline}
                className="w-full py-3 px-4 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
              >
                {t('declineConfirmYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

