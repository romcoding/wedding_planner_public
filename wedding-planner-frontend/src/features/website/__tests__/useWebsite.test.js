import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ensureDocument } from '../siteSchema'
import useWebsite from '../hooks/useWebsite'

const getSiteMock = vi.fn()
const saveContentMock = vi.fn()
const saveSettingsMock = vi.fn()
const publishSiteMock = vi.fn()
const unpublishSiteMock = vi.fn()
const restoreRevisionMock = vi.fn()
const listRevisionsMock = vi.fn()
const generateContentMock = vi.fn()
const getGenerationStatusMock = vi.fn()
const checkSlugMock = vi.fn()

vi.mock('../api', () => ({
  getSite: (...a) => getSiteMock(...a),
  saveContent: (...a) => saveContentMock(...a),
  saveSettings: (...a) => saveSettingsMock(...a),
  publishSite: (...a) => publishSiteMock(...a),
  unpublishSite: (...a) => unpublishSiteMock(...a),
  restoreRevision: (...a) => restoreRevisionMock(...a),
  listRevisions: (...a) => listRevisionsMock(...a),
  generateContent: (...a) => generateContentMock(...a),
  getGenerationStatus: (...a) => getGenerationStatusMock(...a),
  checkSlug: (...a) => checkSlugMock(...a),
}))

function baseSite(overrides = {}) {
  return {
    id: 1,
    slug: 'alex-sam',
    theme: 'classic',
    status: 'draft',
    rsvp_enabled: true,
    has_password: false,
    content: ensureDocument({ blocks: [] }),
    content_version: 1,
    has_unpublished_changes: false,
    published_at: null,
    updated_at: 't0',
    ...overrides,
  }
}

async function mountAndLoad() {
  const view = renderHook(() => useWebsite())
  await act(async () => {})
  return view
}

beforeEach(() => {
  vi.useFakeTimers()
  getSiteMock.mockReset().mockResolvedValue(baseSite())
  saveContentMock.mockReset()
  saveSettingsMock.mockReset()
  publishSiteMock.mockReset()
  unpublishSiteMock.mockReset()
  restoreRevisionMock.mockReset()
  listRevisionsMock.mockReset()
  generateContentMock.mockReset()
  getGenerationStatusMock.mockReset().mockResolvedValue({ used: 0, limit: 30, resetsOn: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useWebsite autosave', () => {
  it('collapses rapid edits into a single save carrying the latest content', async () => {
    saveContentMock.mockResolvedValue({ content_version: 2, has_unpublished_changes: false, updated_at: 't2' })
    const { result } = await mountAndLoad()
    expect(result.current.loading).toBe(false)

    act(() => { result.current.updateBlockData('hero', { tagline: 'A' }) })
    act(() => { result.current.updateBlockData('hero', { tagline: 'B' }) })
    act(() => { result.current.updateBlockData('hero', { tagline: 'C' }) })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(saveContentMock).toHaveBeenCalledTimes(1)
    const [savedContent] = saveContentMock.mock.calls[0]
    expect(savedContent.blocks.find((b) => b.type === 'hero').data.tagline).toBe('C')
    expect(result.current.saveState).toBe('saved')
  })

  it('publish waits for a pending autosave instead of racing it', async () => {
    let resolveSave
    saveContentMock.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve }))
    publishSiteMock.mockResolvedValue(baseSite({ status: 'published', published_at: 't', content_version: 2 }))

    const { result } = await mountAndLoad()

    act(() => { result.current.updateBlockData('hero', { tagline: 'A' } ) })

    let publishPromise
    await act(async () => {
      publishPromise = result.current.publish()
      // let the microtask queue advance enough for flushSave's chain to reach saveContent
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveContentMock).toHaveBeenCalledTimes(1)
    expect(publishSiteMock).not.toHaveBeenCalled()

    await act(async () => {
      resolveSave({ content_version: 2, has_unpublished_changes: false, updated_at: 't2' })
      await publishPromise
    })

    expect(publishSiteMock).toHaveBeenCalledTimes(1)

    // The debounce timer for the same edit must have been cleared by flushSave —
    // advancing past it must not trigger a second, overlapping save.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(saveContentMock).toHaveBeenCalledTimes(1)
  })

  it('flushes a pending edit on unmount instead of dropping it', async () => {
    saveContentMock.mockResolvedValue({ content_version: 2, has_unpublished_changes: false, updated_at: 't2' })
    const { result, unmount } = await mountAndLoad()

    act(() => { result.current.updateBlockData('hero', { tagline: 'Last edit' }) })

    unmount()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveContentMock).toHaveBeenCalledTimes(1)
    const [savedContent] = saveContentMock.mock.calls[0]
    expect(savedContent.blocks.find((b) => b.type === 'hero').data.tagline).toBe('Last edit')
  })

  it('never issues overlapping saveContent calls even when triggers overlap', async () => {
    let inFlight = 0
    let maxInFlight = 0
    saveContentMock.mockImplementation(() => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      return new Promise((resolve) => {
        setTimeout(() => {
          inFlight -= 1
          resolve({ content_version: 2, has_unpublished_changes: false, updated_at: 't2' })
        }, 50)
      })
    })
    publishSiteMock.mockResolvedValue(baseSite({ status: 'published', content_version: 2 }))

    const { result } = await mountAndLoad()

    act(() => { result.current.updateBlockData('hero', { tagline: 'A' }) })

    let publishPromise
    act(() => { publishPromise = result.current.publish() })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
      await publishPromise
    })

    expect(maxInFlight).toBeLessThanOrEqual(1)
  })

  it('stops autosaving after a version conflict until the page reloads', async () => {
    saveContentMock.mockRejectedValueOnce({
      response: { status: 409, data: { code: 'version_conflict', current_version: 5 } },
    })
    const { result } = await mountAndLoad()

    act(() => { result.current.updateBlockData('hero', { tagline: 'A' }) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(result.current.saveState).toBe('conflict')
    expect(saveContentMock).toHaveBeenCalledTimes(1)

    // Further edits must not trigger another send — the queue is blocked.
    act(() => { result.current.updateBlockData('hero', { tagline: 'B' }) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(saveContentMock).toHaveBeenCalledTimes(1)
  })
})
