import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
})

// Add token to requests if available (admin or guest)
api.interceptors.request.use((config) => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const isAdminRoute = pathname.startsWith('/admin') || pathname.includes('moodboard')

  // Determine which token to use based on the endpoint
  const url = config.url || ''
  const isGuestEndpoint = url.includes('/guests/update-rsvp') || 
                         url.includes('/guests/token/') ||
                         url.includes('/guest-auth/') ||
                         url.includes('/guest-photos') ||
                         url.includes('/messages') ||
                         // Public-ish endpoints that must use guest token when browsing guest UI,
                         // otherwise an existing admin token would leak private data to guests.
                         (!isAdminRoute && (url.includes('/events') || url.includes('/images') || url.includes('/content') || url.includes('/gift-registry')))
  
  let token = null
  if (isGuestEndpoint || !isAdminRoute) {
    // For guest endpoints, prioritize guest token
    token = localStorage.getItem('guest_token') || localStorage.getItem('access_token')
  } else {
    // For admin endpoints, prioritize admin token
    token = localStorage.getItem('access_token') || localStorage.getItem('guest_token')
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  
  // Only set Content-Type for requests with data (POST, PUT, PATCH)
  // Don't set it for GET requests or FormData
  if (config.data) {
    if (config.data instanceof FormData) {
      // Don't set Content-Type for FormData - let browser set it with boundary
      delete config.headers['Content-Type']
    } else if (typeof config.data === 'object') {
      // Set Content-Type for JSON requests
      config.headers['Content-Type'] = 'application/json'
    }
  }
  
  return config
})

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Check if it's an admin or guest request
      const isAdmin = localStorage.getItem('access_token')
      const isGuest = localStorage.getItem('guest_token')
      
      if (isAdmin) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        window.location.href = '/admin/login'
      } else if (isGuest) {
        localStorage.removeItem('guest_token')
        localStorage.removeItem('guest')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

