import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_URL,
})

// Add token to requests if available (admin or guest)
api.interceptors.request.use((config) => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const isAdminRoute = pathname.startsWith('/admin') || pathname.includes('moodboard')

  const url = config.url || ''
  const isGuestEndpoint =
    url.includes('/guests/update-rsvp') ||
    url.includes('/guests/token/') ||
    url.includes('/guest-auth/') ||
    url.includes('/guest-photos') ||
    url.includes('/messages') ||
    (!isAdminRoute &&
      (url.includes('/events') ||
        url.includes('/images') ||
        url.includes('/content') ||
        url.includes('/gift-registry')))

  // Use sessionStorage (no localStorage — XSS risk)
  let token = null
  if (isGuestEndpoint || !isAdminRoute) {
    token = sessionStorage.getItem('guest_token') || sessionStorage.getItem('access_token')
  } else {
    token = sessionStorage.getItem('access_token') || sessionStorage.getItem('guest_token')
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (config.data) {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    } else if (typeof config.data === 'object') {
      config.headers['Content-Type'] = 'application/json'
    }
  }

  return config
})

// Handle 401 — clear session and redirect to auth
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const isAdmin = sessionStorage.getItem('access_token')
      const isGuest = sessionStorage.getItem('guest_token')

      if (isAdmin) {
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('user')
        window.location.href = '/auth?tab=login'
      } else if (isGuest) {
        sessionStorage.removeItem('guest_token')
        sessionStorage.removeItem('guest')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
