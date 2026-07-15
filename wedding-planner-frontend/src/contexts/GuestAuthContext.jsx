import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const GuestAuthContext = createContext(null)

export function GuestAuthProvider({ children }) {
  const [guest, setGuest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Use sessionStorage — no localStorage (XSS risk)
    const token = sessionStorage.getItem('guest_token')
    const storedGuest = sessionStorage.getItem('guest')

    if (token && storedGuest) {
      try {
        setGuest(JSON.parse(storedGuest))
      } catch {
        sessionStorage.removeItem('guest_token')
        sessionStorage.removeItem('guest')
      }
      api.get('/guest-auth/profile')
        .then((res) => {
          const updatedGuest = res.data
          sessionStorage.setItem('guest', JSON.stringify(updatedGuest))
          setGuest(updatedGuest)
        })
        .catch(() => {
          sessionStorage.removeItem('guest_token')
          sessionStorage.removeItem('guest')
          setGuest(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const loginWithToken = (access_token, guestInfo) => {
    sessionStorage.setItem('guest_token', access_token)
    sessionStorage.setItem('guest', JSON.stringify(guestInfo))
    setGuest(guestInfo)
  }

  const logout = () => {
    sessionStorage.removeItem('guest_token')
    sessionStorage.removeItem('guest')
    setGuest(null)
  }

  return (
    <GuestAuthContext.Provider value={{ guest, loading, loginWithToken, logout }}>
      {children}
    </GuestAuthContext.Provider>
  )
}

export function useGuestAuth() {
  const context = useContext(GuestAuthContext)
  if (!context) {
    throw new Error('useGuestAuth must be used within GuestAuthProvider')
  }
  return context
}
