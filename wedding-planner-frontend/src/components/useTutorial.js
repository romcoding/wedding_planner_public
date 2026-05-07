import { useCallback, useEffect, useState } from 'react'

function readSeen(storageKey) {
  if (!storageKey || typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(storageKey) === '1'
  } catch {
    return false
  }
}

function writeSeen(storageKey) {
  if (!storageKey || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, '1')
  } catch {
    /* ignore quota / privacy-mode failures */
  }
}

function clearSeen(storageKey) {
  if (!storageKey || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    /* ignore */
  }
}

export function useTutorial(tutorial, { autoOpen = true } = {}) {
  const storageKey = tutorial?.storageKey
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!autoOpen || !tutorial) return
    if (storageKey && readSeen(storageKey)) return
    setIsOpen(true)
  }, [autoOpen, tutorial, storageKey])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => {
    setIsOpen(false)
    if (storageKey) writeSeen(storageKey)
  }, [storageKey])

  const reset = useCallback(() => clearSeen(storageKey), [storageKey])

  return { isOpen, open, close, reset }
}
