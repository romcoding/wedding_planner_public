import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const GuestAuthContext = createContext(null)

export function GuestAuthProvider({ children }) {
  const [guest, setGuest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('guest_token')
    const storedGuest = localStorage.getItem('guest')
    
    if (token && storedGuest) {
      setGuest(JSON.parse(storedGuest))
      // Verify token is still valid
      // You can add a profile endpoint later if needed
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      const response = await api.post('/guest-auth/login', { username, password })
      const { access_token, guest } = response.data
      
      localStorage.setItem('guest_token', access_token)
      localStorage.setItem('guest', JSON.stringify(guest))
      setGuest(guest)
      
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      }
    }
  }

  const loginWithToken = (access_token, guestInfo) => {
    localStorage.setItem('guest_token', access_token)
    localStorage.setItem('guest', JSON.stringify(guestInfo))
    setGuest(guestInfo)
  }

  const logout = () => {
    localStorage.removeItem('guest_token')
    localStorage.removeItem('guest')
    setGuest(null)
  }

  return (
    <GuestAuthContext.Provider value={{ guest, loading, login, loginWithToken, logout }}>
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

