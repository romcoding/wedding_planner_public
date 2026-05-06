import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Use sessionStorage — no localStorage (XSS risk)
    const token = sessionStorage.getItem('access_token')
    const storedUser = sessionStorage.getItem('user')

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('user')
      }
      // Verify token is still valid
      api.get('/auth/profile')
        .then((response) => {
          setUser(response.data)
          sessionStorage.setItem('user', JSON.stringify(response.data))
        })
        .catch(() => {
          sessionStorage.removeItem('access_token')
          sessionStorage.removeItem('user')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { access_token, user } = response.data

      sessionStorage.setItem('access_token', access_token)
      sessionStorage.setItem('user', JSON.stringify(user))
      setUser(user)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.detail || 'Login failed',
      }
    }
  }

  const logout = () => {
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('user')
    setUser(null)
  }

  const registerCouple = async (payload) => {
    try {
      const response = await api.post('/auth/couple/register', payload)
      const { access_token, user } = response.data

      sessionStorage.setItem('access_token', access_token)
      sessionStorage.setItem('user', JSON.stringify(user))
      setUser(user)

      return {
        success: true,
        data: response.data,
        wedding: response.data.wedding,
      }
    } catch (error) {
      const detail = error.response?.data?.detail
      // FastAPI wraps structured errors as the detail field
      const errorData = typeof detail === 'object' ? detail : null
      return {
        success: false,
        error: errorData?.message || (typeof detail === 'string' ? detail : null) || 'Registration failed',
        errorData,
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerCouple }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
