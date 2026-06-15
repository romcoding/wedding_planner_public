// useWebsite — load the site, edit the content document with a 1.5s debounced
// autosave, and drive settings / publish / unpublish / restore. The content
// document is the local source of truth while editing (the server response is
// not echoed back into it mid-edit, so inputs never jump); meta fields (theme,
// slug, status, ...) are synced from the server on every settings/publish call.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as websiteApi from '../api'
import { ensureDocument, DEFAULT_THEME } from '../siteSchema'

const AUTOSAVE_MS = 1500

export function useWebsite() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [site, setSite] = useState(null)
  const [content, setContent] = useState(null)
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState('draft')
  const [rsvpEnabled, setRsvpEnabled] = useState(true)
  const [hasPassword, setHasPassword] = useState(false)
  const [publishedAt, setPublishedAt] = useState(null)
  // 'saved' | 'unsaved' | 'saving' | 'error'
  const [saveState, setSaveState] = useState('saved')
  // Wedi monthly usage: { used, limit, resetsOn } (null until loaded).
  const [wedi, setWedi] = useState(null)

  const contentRef = useRef(null)
  const timerRef = useRef(null)

  const hydrateMeta = useCallback((data) => {
    setSite(data)
    setTheme(data.theme || DEFAULT_THEME)
    setSlug(data.slug || '')
    setStatus(data.status || 'draft')
    setRsvpEnabled(!!data.rsvp_enabled)
    setHasPassword(!!data.has_password)
    setPublishedAt(data.published_at || null)
  }, [])

  const hydrateAll = useCallback((data) => {
    hydrateMeta(data)
    const doc = ensureDocument(data.content)
    contentRef.current = doc
    setContent(doc)
  }, [hydrateMeta])

  useEffect(() => {
    let alive = true
    websiteApi
      .getSite()
      .then((data) => {
        if (!alive) return
        hydrateAll(data)
        setLoading(false)
      })
      .catch((e) => {
        if (!alive) return
        setError(e?.response?.data || 'Failed to load your website')
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [hydrateAll])

  // Clear any pending autosave timer on unmount.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!contentRef.current) return
    setSaveState('saving')
    try {
      const updated = await websiteApi.saveContent(contentRef.current)
      setSite((prev) => ({ ...(prev || {}), updated_at: updated.updated_at }))
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [])

  const scheduleSave = useCallback(() => {
    setSaveState('unsaved')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      flushSave()
    }, AUTOSAVE_MS)
  }, [flushSave])

  const updateBlockData = useCallback((type, patch) => {
    setContent((prev) => {
      const next = {
        ...prev,
        blocks: prev.blocks.map((b) => (b.type === type ? { ...b, data: { ...b.data, ...patch } } : b)),
      }
      contentRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const setBlockEnabled = useCallback((type, enabled) => {
    setContent((prev) => {
      const next = {
        ...prev,
        blocks: prev.blocks.map((b) => (b.type === type ? { ...b, enabled } : b)),
      }
      contentRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const saveSettings = useCallback(async (patch) => {
    await flushSave()
    const updated = await websiteApi.saveSettings(patch)
    hydrateMeta(updated)
    return updated
  }, [flushSave, hydrateMeta])

  const publish = useCallback(async () => {
    await flushSave()
    const updated = await websiteApi.publishSite()
    hydrateMeta(updated)
    return updated
  }, [flushSave, hydrateMeta])

  const unpublish = useCallback(async () => {
    const updated = await websiteApi.unpublishSite()
    hydrateMeta(updated)
    return updated
  }, [hydrateMeta])

  const restore = useCallback(async (id) => {
    const updated = await websiteApi.restoreRevision(id)
    hydrateAll(updated)
    setSaveState('saved')
    return updated
  }, [hydrateAll])

  const loadWedi = useCallback(async () => {
    try {
      const data = await websiteApi.getGenerationStatus()
      setWedi(data)
      return data
    } catch {
      return null
    }
  }, [])

  // Load Wedi's monthly usage once the feature is available.
  useEffect(() => {
    loadWedi()
  }, [loadWedi])

  const generate = useCallback(async (prompt, mode = 'full') => {
    // Flush any pending edits first so the server's draft is current — essential
    // for 'refine', which the model bases on the stored draft_content.
    await flushSave()
    const res = await websiteApi.generateContent(prompt, mode)
    const doc = ensureDocument(res.content)
    contentRef.current = doc
    setContent(doc)
    setSaveState('saved') // the server already persisted this into the draft
    loadWedi()
    return res
  }, [flushSave, loadWedi])

  return {
    loading,
    error,
    site,
    content,
    theme,
    slug,
    status,
    rsvpEnabled,
    hasPassword,
    publishedAt,
    saveState,
    wedi,
    updateBlockData,
    setBlockEnabled,
    saveSettings,
    publish,
    unpublish,
    restore,
    generate,
    reloadWedi: loadWedi,
    checkSlug: websiteApi.checkSlug,
    listRevisions: websiteApi.listRevisions,
  }
}

export default useWebsite
