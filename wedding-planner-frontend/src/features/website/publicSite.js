// Absolute base URL for published public wedding sites, served by the backend
// worker at /s/{slug}. Prefer an explicit build-time VITE_PUBLIC_SITE_BASE_URL;
// otherwise derive it from the API origin (VITE_API_URL without its /api path),
// so links resolve on day one without a custom domain. See DEPLOY.md.

export function publicSiteBaseUrl() {
  const explicit = import.meta.env.VITE_PUBLIC_SITE_BASE_URL
  if (explicit) return String(explicit).replace(/\/+$/, '')
  const api = import.meta.env.VITE_API_URL
  if (api) {
    try {
      return new URL(api).origin
    } catch {
      /* malformed — fall through */
    }
  }
  if (typeof window !== 'undefined' && window.location) return window.location.origin
  return ''
}

export function publicSiteUrl(slug) {
  return `${publicSiteBaseUrl()}/s/${slug || ''}`
}
