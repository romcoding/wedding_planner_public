/**
 * Client-side analytics tracking utility
 * Automatically tracks page views and sessions
 */

let sessionId = null
let visitStarted = false

// Initialize session on load
function initSession() {
  // Get or create session ID from sessionStorage
  sessionId = sessionStorage.getItem('analytics_session_id')
  if (!sessionId) {
    sessionId = generateSessionId()
    sessionStorage.setItem('analytics_session_id', sessionId)
  }
  
  // Start visit tracking
  if (!visitStarted) {
    startVisit()
    visitStarted = true
  }
}

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

async function startVisit() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    // Get base URL and ensure it doesn't have double /api
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')
    const response = await fetch(`${baseUrl}/api/analytics/track/visit/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: user?.id || null,
        guest_id: null, // Could be extracted from token if guest is logged in
      }),
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.session_id) {
        sessionId = data.session_id
        sessionStorage.setItem('analytics_session_id', sessionId)
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) console.error('Error starting visit tracking:', error)
  }
}

export function trackPageView(pagePath, pageTitle = null) {
  if (!sessionId) {
    initSession()
  }
  
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    // Get base URL and ensure it doesn't have double /api
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')
    
    fetch(`${baseUrl}/api/analytics/track/pageview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_path: pagePath,
        page_title: pageTitle || document.title,
        session_id: sessionId,
        user_id: user?.id || null,
        guest_id: null,
      }),
    }).catch(error => {
      if (import.meta.env.DEV) console.error('Error tracking page view:', error)
    })
  } catch (error) {
    if (import.meta.env.DEV) console.error('Error in trackPageView:', error)
  }
}

export function endVisit() {
  if (!sessionId) {
    return
  }

  try {
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')
    const url = `${baseUrl}/api/analytics/track/visit/end`
    const payload = JSON.stringify({ session_id: sessionId })

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
      return
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(error => {
      if (import.meta.env.DEV) console.error('Error ending visit:', error)
    })
  } catch (error) {
    if (import.meta.env.DEV) console.error('Error in endVisit:', error)
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  initSession()
  
  // Track page view on initial load
  setTimeout(() => {
    trackPageView(window.location.pathname, document.title)
  }, 100)
  
  // Track page view on popstate (browser back/forward)
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      trackPageView(window.location.pathname, document.title)
    }, 100)
  })
  
  // End visit on page unload
  window.addEventListener('beforeunload', () => {
    endVisit()
  })
  
  // Track visibility changes (when user switches tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // User left the page
      endVisit()
    } else {
      // User returned to the page
      startVisit()
    }
  })
}

// Export function to manually track route changes (for React Router)
export function trackRouteChange(pathname, title = null) {
  trackPageView(pathname, title || document.title)
}

export { sessionId }
