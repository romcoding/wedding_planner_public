import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available (admin or guest)
api.interceptors.request.use((config) => {
  // Try admin token first, then guest token
  const adminToken = localStorage.getItem('access_token')
  const guestToken = localStorage.getItem('guest_token')
  const token = adminToken || guestToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Don't set Content-Type for FormData - let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
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

