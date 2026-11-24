import { createContext, useContext, useState, useEffect } from 'react'
import api, { getApiError, getApiCode, getApiData } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    const storedUser = sessionStorage.getItem('user')

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('user')
      }
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
        error: getApiError(error, 'Login failed'),
        errorCode: getApiCode(error),
        email,
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

      // Only open a session if email verification is NOT required.
      // If it is required the user must verify first; setting user here
      // would trigger the redirect-to-dashboard effect prematurely.
      if (!response.data.email_verification_required) {
        sessionStorage.setItem('access_token', access_token)
        sessionStorage.setItem('user', JSON.stringify(user))
        setUser(user)
      }

      return {
        success: true,
        data: response.data,
        wedding: response.data.wedding,
      }
    } catch (error) {
      // errorData carries the structured extras: code, missing_fields, errors.
      return {
        success: false,
        error: getApiError(error, 'Registration failed'),
        errorCode: getApiCode(error),
        errorData: getApiData(error),
      }
    }
  }

  const resendVerification = async (email) => {
    try {
      await api.post('/auth/resend-verification', { email })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: getApiError(error, 'Could not resend verification email'),
      }
    }
  }

  const forgotPassword = async (email) => {
    try {
      await api.post('/auth/forgot-password', { email })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: getApiError(error, 'Could not send reset email'),
      }
    }
  }

  const resetPassword = async (token, password, passwordConfirmation) => {
    try {
      await api.post('/auth/reset-password', {
        token,
        password,
        password_confirmation: passwordConfirmation,
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: getApiError(error, 'Password reset failed'),
        errors: getApiData(error)?.errors,
      }
    }
  }

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, logout, registerCouple,
      resendVerification, forgotPassword, resetPassword,
    }}>
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
