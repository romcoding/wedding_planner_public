import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Heart, Loader } from 'lucide-react'
import { useGuestAuth } from '../../contexts/GuestAuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import api from '../../lib/api'

/**
 * GuestEntry - Handles guest authentication via invite token and redirects to /info
 * 
 * This is the entry point for guests clicking their invitation link.
 * It authenticates them and redirects to the main guest page where the
 * wizard popup will appear for first-time guests.
 */
export default function GuestEntry() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { guest, loginWithToken } = useGuestAuth()
  const { t, setLanguage } = useLanguage()
  const [error, setError] = useState('')

  // Store the invite token for later use (e.g., wizard popup in Info.jsx)
  useEffect(() => {
    if (!token) return
    try {
      localStorage.setItem('guest_invite_token', token)
    } catch {
      // ignore
    }
  }, [token])

  // Fetch guest data by token
  const { data: guestData, isLoading: loadingGuest, error: fetchError } = useQuery({
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
      
      // Set language if guest has one
      if (guestInfo?.language) {
        setLanguage(guestInfo.language)
      }
      
      // Redirect to the main guest page (Info) - wizard will popup there for first-time guests
      // Use setTimeout to ensure state update has propagated before navigation
      setTimeout(() => {
        navigate('/info', { replace: true })
      }, 50)
    },
    onError: (err) => {
      setError(err.response?.data?.error || t('authFailed') || 'Authentication failed')
    },
  })

  // Auto-authenticate when guest data is loaded
  useEffect(() => {
    if (!guestData) return
    
    // Check if already authenticated as this guest
    const storedGuestRaw = localStorage.getItem('guest')
    let storedGuestId = null
    try {
      storedGuestId = storedGuestRaw ? JSON.parse(storedGuestRaw)?.id : null
    } catch {
      storedGuestId = null
    }
    
    const guestToken = localStorage.getItem('guest_token')
    const isAlreadyAuthenticated = guestToken && storedGuestId === guestData.id
    
    if (isAlreadyAuthenticated) {
      // Already authenticated as this guest, redirect directly
      navigate('/info', { replace: true })
      return
    }
    
    // Need to authenticate
    authMutation.mutate()
  }, [guestData])

  // Handle fetch error
  useEffect(() => {
    if (fetchError) {
      setError(fetchError.response?.data?.error || t('invalidInvitationLinkMessage') || 'Invalid invitation link')
    }
  }, [fetchError, t])

  // Loading state
  if (loadingGuest || authMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--wp-primary-5), var(--wp-background), var(--wp-secondary-5))' }}>
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: 'var(--wp-primary)' }} />
          <p className="text-gray-600">{t('loadingWeddingPass') || 'Loading your invitation...'}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !guestData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--wp-primary-5), var(--wp-background), var(--wp-secondary-5))' }}>
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('invalidInvitationLinkTitle') || 'Invalid Invitation'}
            </h2>
            <p className="text-gray-600 mb-4">
              {error || t('invalidInvitationLinkMessage') || 'This invitation link is not valid or has expired.'}
            </p>
            <p className="text-gray-500 text-sm">
              {t('invalidInvitationContactHint') || 'If you believe this is an error, please contact the bride and groom for a new invitation link.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Should not reach here, but show loading as fallback
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--wp-primary-5), var(--wp-background), var(--wp-secondary-5))' }}>
      <Loader className="w-12 h-12 animate-spin" style={{ color: 'var(--wp-primary)' }} />
    </div>
  )
}
