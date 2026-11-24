/**
 * Client-side page-view tracking.
 *
 * Posts to the one real endpoint, POST /analytics/track ({path, referrer}).
 * There is no visit/session tracking: the old /track/visit/start|end and
 * /track/pageview routes never existed on the backend.
 *
 * Signed-in app screens (admin, auth, onboarding) are never tracked — couples'
 * analytics are about their published site, not about them using this app.
 * Rows without a site slug are stored with no wedding, so they never appear in
 * any couple's numbers.
 */
import api from '../lib/api'

const UNTRACKED_PREFIXES = ['/admin', '/auth', '/onboarding']

let lastPath = null

export function shouldTrack(pathname) {
  return !!pathname && !UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function trackPageView(pagePath) {
  if (!shouldTrack(pagePath) || pagePath === lastPath) return
  lastPath = pagePath
  const referrer = typeof document !== 'undefined' ? document.referrer || null : null
  // Fire and forget; analytics must never surface an error to the user.
  api.post('/analytics/track', { path: pagePath, referrer }).catch(() => {})
}

// React Router calls this on every route change (see App.jsx).
export function trackRouteChange(pathname) {
  trackPageView(pathname)
}
