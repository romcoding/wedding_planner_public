import { useEffect, useRef, useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'

// Public-address field with a debounced availability check. The slug is only
// persisted (via onSave) when the user confirms an available address.
export default function SlugField({ value, onSave, checkSlug }) {
  const [input, setInput] = useState(value || '')
  const [result, setResult] = useState(null) // { slug, available, reason }
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    setInput(value || '')
  }, [value])

  useEffect(() => {
    if (!input || input === value) {
      setResult(null)
      setChecking(false)
      return undefined
    }
    setChecking(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        setResult(await checkSlug(input))
      } catch {
        setResult(null)
      } finally {
        setChecking(false)
      }
    }, 450)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [input, value, checkSlug])

  const changed = input !== value
  const canSave = changed && result && result.available && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave(result.slug || input)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Public address</label>
      <div className="flex items-stretch gap-2">
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden flex-1 min-w-0">
          <span className="px-2.5 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 py-2">/s/</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="our-wedding"
            maxLength={40}
            className="flex-1 min-w-0 px-2.5 py-2 text-sm outline-none"
          />
          <span className="px-2 flex items-center">
            {checking ? (
              <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
            ) : changed && result ? (
              result.available ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <X className="w-4 h-4 text-red-400" />
              )
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="px-3 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-40"
          style={{ background: '#C4956A' }}
        >
          {saving ? 'Saving…' : 'Use'}
        </button>
      </div>
      {changed && result && !result.available && result.reason ? (
        <p className="text-xs text-red-500 mt-1">{result.reason}</p>
      ) : null}
    </div>
  )
}
