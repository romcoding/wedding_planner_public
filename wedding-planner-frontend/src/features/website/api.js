// Thin wrapper over the shared axios client for the website builder endpoints.
import api from '../../lib/api'

export const getSite = () => api.get('/website').then((r) => r.data)
export const saveContent = (content) => api.put('/website/content', { content }).then((r) => r.data)
export const saveSettings = (patch) => api.put('/website/settings', patch).then((r) => r.data)
export const checkSlug = (slug) => api.get('/website/slug-check', { params: { slug } }).then((r) => r.data)
export const publishSite = () => api.post('/website/publish').then((r) => r.data)
export const unpublishSite = () => api.post('/website/unpublish').then((r) => r.data)
export const listRevisions = () => api.get('/website/revisions').then((r) => r.data)
export const restoreRevision = (id) => api.post(`/website/revisions/${id}/restore`).then((r) => r.data)

// Wedi generation ("Wedi designs your website").
export const generateContent = (prompt, mode = 'full') =>
  api.post('/website/generate', { prompt, mode }).then((r) => r.data)
export const getGenerationStatus = () => api.get('/website/generation-status').then((r) => r.data)

// Public-site RSVP inbox.
export const getRsvps = (params = {}) =>
  api.get('/website/rsvps', { params }).then((r) => r.data)
export const addRsvpToGuests = (id) =>
  api.post(`/website/rsvps/${id}/add-guest`).then((r) => r.data)
