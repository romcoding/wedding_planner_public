// useWebsite — load the site, edit the content document with a 1.5s debounced
// autosave, and drive settings / publish / unpublish / restore. The content
// document is the local source of truth while editing (the server response is
// not echoed back into it mid-edit, so inputs never jump); meta fields (theme,
// slug, status, ...) are synced from the server on every settings/publish call.
//
// Autosave is serialized through one promise chain (saveChainRef) so a
// debounce-triggered save and an explicit save (from publish/settings/
// generate) can never race — the second call always waits for the first to
// finish, which also makes out-of-order network responses structurally
// impossible (a request is never issued until the previous one's response
// has been processed). A server-side `content_version` additionally guards
// against two tabs/devices editing the same site: a stale write is rejected
// with 409 and the queue stops until the user reloads (see `saveState ===
// 'conflict'`).

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
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false)
  // 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'
  const [saveState, setSaveState] = useState('saved')
  // Wedi monthly usage: { used, limit, resetsOn } (null until loaded).
  const [wedi, setWedi] = useState(null)

  const contentRef = useRef(null)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)
  // Every flushSave() chains onto this so calls never overlap.
  const saveChainRef = useRef(Promise.resolve())
  // The last content_version the server confirmed. Sent as expected_version
  // on every save so the server can detect a stale (multi-tab) write.
  const versionRef = useRef(1)
  // Set once a 409 version_conflict is hit; blocks further autosaves until
  // the user reloads (the hook is re-created fresh on reload).
  const conflictRef = useRef(false)

  const hydrateMeta = useCallback((data) => {
    setSite(data)
    setTheme(data.theme || DEFAULT_THEME)
    setSlug(data.slug || '')
    setStatus(data.status || 'draft')
    setRsvpEnabled(!!data.rsvp_enabled)
    setHasPassword(!!data.has_password)
    setPublishedAt(data.published_at || null)
    setHasUnpublishedChanges(!!data.has_unpublished_changes)
    if (typeof data.content_version === 'number') {
      versionRef.current = data.content_version
    }
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

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const payload = contentRef.current
    const run = async () => {
      if (conflictRef.current || !payload) return
      if (mountedRef.current) setSaveState('saving')
      try {
        const updated = await websiteApi.saveContent(payload, versionRef.current)
        versionRef.current = updated.content_version
        if (mountedRef.current) {
          setSite((prev) => ({
            ...(prev || {}),
            updated_at: updated.updated_at,
            has_unpublished_changes: updated.has_unpublished_changes,
          }))
          setHasUnpublishedChanges(!!updated.has_unpublished_changes)
          setSaveState('saved')
        }
      } catch (err) {
        if (err?.response?.status === 409 && err?.response?.data?.code === 'version_conflict') {
          conflictRef.current = true
          if (mountedRef.current) setSaveState('conflict')
          return
        }
        if (mountedRef.current) setSaveState('error')
      }
    }
    // Chain after the prior save regardless of its outcome, so this call
    // always waits its turn — this is what makes concurrent saves impossible.
    const next = saveChainRef.current.then(run, run)
    saveChainRef.current = next
    return next
  }, [])

  const scheduleSave = useCallback(() => {
    setSaveState('unsaved')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      flushSave()
    }, AUTOSAVE_MS)
  }, [flushSave])

  // Flush (not drop) a pending edit on unmount. mountedRef flips to false
  // synchronously first, so flushSave's async continuation never calls
  // setState on an unmounted component — the save itself still completes.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) flushSave()
    }
  }, [flushSave])

  // Warn before leaving the tab/page while there's an unsent edit, an
  // in-flight save, or a blocked conflict (edits that can't be sent until
  // the user reloads).
  useEffect(() => {
    const handler = (e) => {
      if (saveState === 'unsaved' || saveState === 'saving' || saveState === 'conflict') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveState])

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
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
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
    if (typeof res.content_version === 'number') versionRef.current = res.content_version
    // Wedi only ever writes to the draft, never publishes — so if the site is
    // already live, a generated draft is unpublished by definition.
    if (status === 'published') setHasUnpublishedChanges(true)
    loadWedi()
    return res
  }, [flushSave, loadWedi, status])

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
    hasUnpublishedChanges,
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
